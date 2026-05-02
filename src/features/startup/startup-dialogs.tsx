import { AlertTriangle, CheckCircle2, FolderOpen, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { tauriClient } from "@/services/tauri-client";
import { useCategoryManagementStore } from "@/stores/use-category-management-store";
import { logger } from "@/lib/logger";

const HEALTH_URL_CANDIDATES = [
  "http://127.0.0.1:8000/health",
  "http://localhost:8000/health",
];

const STARTUP_POLL_INTERVAL_MS = 1200;
const WORKER_READY_TIMEOUT_MS = 20_000;
const CHAT_READY_TIMEOUT_MS = 75_000;
const HTTP_REQUEST_TIMEOUT_MS = 2500;

const DEFAULT_PATH_URL_CANDIDATES = [
  "http://127.0.0.1:8000/api/settings/default-base-path",
  "http://localhost:8000/api/settings/default-base-path",
];

export interface FailedService {
  name: string;
  detail: string;
}

export interface StartupCheckResult {
  healthIssues: FailedService[];
  defaultPathSet: { path: string } | null;
}

interface WorkerHealthResponse {
  status: string;
  services: Record<string, { ok: boolean; detail: string }>;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

async function fetchJsonWithTimeout<T>(url: string, timeoutMs = HTTP_REQUEST_TIMEOUT_MS): Promise<T> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      throw new Error(`Request failed: ${res.status}`);
    }
    return res.json() as Promise<T>;
  } finally {
    window.clearTimeout(timer);
  }
}

async function fetchWorkerHealthOnce(): Promise<WorkerHealthResponse> {
  return fetchFirstSuccess(HEALTH_URL_CANDIDATES, async (url) => fetchJsonWithTimeout<WorkerHealthResponse>(url));
}

async function waitForWorkerHealth(timeoutMs: number): Promise<WorkerHealthResponse | null> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      return await fetchWorkerHealthOnce();
    } catch {
      await sleep(STARTUP_POLL_INTERVAL_MS);
    }
  }

  return null;
}

async function ensureDefaultPathIfMissing(): Promise<{ path: string } | null> {
  try {
    const defaultPath = await fetchFirstSuccess(DEFAULT_PATH_URL_CANDIDATES, async (url) => {
      const res = await fetchJsonWithTimeout<{ default_base_path: string | null }>(url);
      return res;
    });

    if (defaultPath.default_base_path !== null) {
      return null;
    }

    const suggestedPath = await getDefaultKlinPath();
    await fetchFirstSuccess(DEFAULT_PATH_URL_CANDIDATES, async (url) => {
      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), HTTP_REQUEST_TIMEOUT_MS);
      try {
        const res = await fetch(url, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ default_base_path: suggestedPath }),
          signal: controller.signal,
        });
        if (!res.ok) {
          throw new Error(`Failed to set default path: ${res.status}`);
        }
        return res.json();
      } finally {
        window.clearTimeout(timer);
      }
    });

    useCategoryManagementStore.getState().setManagementState(
      suggestedPath,
      useCategoryManagementStore.getState().categories,
    );
    return { path: suggestedPath };
  } catch (e) {
    logger.warn("[startup] default path setup failed, bootstrap will retry", e);
    return null;
  }
}

async function fetchFirstSuccess<T>(candidates: string[], request: (url: string) => Promise<T>): Promise<T> {
  let lastError: unknown = null;
  for (const url of candidates) {
    try {
      return await request(url);
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError ?? new Error("All candidates failed");
}

async function getDefaultKlinPath(): Promise<string> {
  const downloads = await tauriClient.getDownloadsFolder();
  const normalized = downloads.replace(/[\\/]+$/, "");
  const lastSlash = Math.max(normalized.lastIndexOf("/"), normalized.lastIndexOf("\\"));
  const homeDir = lastSlash > 0 ? normalized.slice(0, lastSlash) : normalized;
  const sep = normalized.includes("\\") ? "\\" : "/";
  return `${homeDir}${sep}KlinFiles`;
}

export async function runStartupChecks(): Promise<StartupCheckResult> {
  const healthIssues: FailedService[] = [];
  const defaultPathPromise = ensureDefaultPathIfMissing();
  const warmupChatPromise = tauriClient.warmupChatModel();

  const workerHealth = await waitForWorkerHealth(WORKER_READY_TIMEOUT_MS);
  if (!workerHealth) {
    healthIssues.push({
      name: "Worker API",
      detail: "Worker did not become ready in time. Check klin-worker startup logs.",
    });

    const defaultPathSet = await defaultPathPromise;
    return { healthIssues, defaultPathSet };
  }

  for (const [name, status] of Object.entries(workerHealth.services)) {
    if (name === "LLM Server") {
      continue;
    }

    if (!status.ok) {
      healthIssues.push({ name, detail: status.detail });
    }
  }

  let chatWarmupError: unknown = null;
  try {
    await Promise.race([
      warmupChatPromise,
      new Promise<never>((_, reject) =>
        window.setTimeout(() => reject(new Error("chat warmup timeout")), CHAT_READY_TIMEOUT_MS),
      ),
    ]);
  } catch (err) {
    chatWarmupError = err;
  }

  if (chatWarmupError) {
    const reason = chatWarmupError instanceof Error ? chatWarmupError.message : "chat slot is not healthy";
    healthIssues.push({
      name: "LLM Chat",
      detail: `Chat model did not become ready in time (${reason}).`,
    });
  }

  let embedEnsureError: unknown = null;
  try {
    await tauriClient.ensureLlamaServer("embed");
  } catch (err) {
    embedEnsureError = err;
    logger.error("[startup] embed model server failed to start", err);
  }

  if (embedEnsureError) {
    const reason = embedEnsureError instanceof Error ? embedEnsureError.message : "embed slot is not healthy";
    healthIssues.push({
      name: "LLM Embedding",
      detail: `Embedding model did not become ready in time (${reason}).`,
    });
  }

  const defaultPathSet = await defaultPathPromise;
  return { healthIssues, defaultPathSet };
}

interface StartupDialogsProps {
  healthIssues: FailedService[];
  defaultPathSet: { path: string } | null;
  onDismissHealth: () => void;
  onDismissDefaultPath: () => void;
  onOpenDefaultFolderSettings: () => void;
}

export function StartupDialogs({
  healthIssues,
  defaultPathSet,
  onDismissHealth,
  onDismissDefaultPath,
  onOpenDefaultFolderSettings,
}: StartupDialogsProps) {
  return (
    <>
      {healthIssues.length > 0 && (
        <div className="fixed inset-0 z-70 flex items-center justify-center bg-background/80 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl">
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Startup</p>
                <h2 className="font-syne text-lg font-black uppercase tracking-tight">Service Health Issues</h2>
              </div>
              <button
                type="button"
                onClick={onDismissHealth}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3 p-6">
              <p className="text-sm text-muted-foreground">
                One or more services are not running correctly. The app may have limited functionality.
              </p>
              <div className="space-y-2">
                {healthIssues.map((service) => (
                  <div
                    key={service.name}
                    className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5"
                  >
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                    <div className="min-w-0">
                      <p className="text-sm font-black text-foreground">{service.name}</p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">{service.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex justify-end pt-1">
                <Button onClick={onDismissHealth}>Dismiss</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {defaultPathSet && (
        <div className="fixed inset-0 z-70 flex items-center justify-center bg-background/80 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl">
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Setup</p>
                <h2 className="font-syne text-lg font-black uppercase tracking-tight">Default Folder Set</h2>
              </div>
              <button
                type="button"
                onClick={onDismissDefaultPath}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-4 p-6">
              <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2.5">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
                <p className="text-sm text-muted-foreground">
                  Your default folder has been automatically configured.
                </p>
              </div>
              <div className="flex items-center gap-2 rounded-lg border border-border bg-muted px-3 py-2">
                <FolderOpen className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="truncate font-mono text-sm text-foreground">{defaultPathSet.path}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                This is where your organized files will be stored by default. You can change it in Settings.
              </p>
              <div className="flex justify-between pt-1">
                <Button variant="outline" onClick={onDismissDefaultPath}>
                  OK
                </Button>
                <Button
                  onClick={() => {
                    onDismissDefaultPath();
                    onOpenDefaultFolderSettings();
                  }}
                >
                  Open Settings
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
