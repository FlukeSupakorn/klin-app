import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  FileX2,
  FolderLock,
  Mail,
  Play,
  RefreshCw,
  Server,
  ShieldCheck,
  SlidersHorizontal,
  Terminal,
  UserCircle2,
  X,
} from "lucide-react";
import { Button } from "@/components/not-use-ui/button";
import { SettingsManagementDialogs } from "@/features/settings/settings-management-dialogs";
import { cn } from "@/lib/utils";
import { googleAuthService } from "@/features/auth/google-auth-service";
import { useAuthStore } from "@/features/auth/use-auth-store";
import { AsyncProcessingQueue } from "@/services/automation-queue";
import { processAutomationJob } from "@/services/automation-service";
import { tauriClient } from "@/services/tauri-client";
import { useAutomationStore } from "@/stores/use-automation-store";
import { usePrivacyStore } from "@/stores/use-privacy-store";
import { useNavigate } from "react-router-dom";

export function SettingsPage() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isCountingWatcherFiles, setIsCountingWatcherFiles] = useState(false);
  const [watcherFolderStats, setWatcherFolderStats] = useState<
    Array<{ folderPath: string; fileCount: number }>
  >([]);
  const [fastApiStatus, setFastApiStatus] = useState<
    "checking" | "online" | "offline"
  >("checking");
  const [isRefreshingDevHealth, setIsRefreshingDevHealth] = useState(false);
  const [startingSlot, setStartingSlot] = useState<string | null>(null);
  const [slotHealth, setSlotHealth] = useState<Record<string, string | null>>({});

  const watchedFolders = useAutomationStore((state) => state.watchedFolders);
  const isRunning = useAutomationStore((state) => state.isRunning);
  const concurrencyLimit = useAutomationStore(
    (state) => state.concurrencyLimit,
  );
  const setRunning = useAutomationStore((state) => state.setRunning);
  const setLastScanTime = useAutomationStore((state) => state.setLastScanTime);
  const queueRef = useRef(new AsyncProcessingQueue(concurrencyLimit));

  const lockedPaths = usePrivacyStore((state) => state.lockedPaths);
  const lockFile = usePrivacyStore((state) => state.lockFile);
  const lockFolder = usePrivacyStore((state) => state.lockFolder);
  const unlockPath = usePrivacyStore((state) => state.unlockPath);
  const hydrateLocks = usePrivacyStore((state) => state.hydrateFromApi);

  const handleLockFiles = async () => {
    const files = await tauriClient.pickFilesForOrganize().catch(() => []);
    await Promise.all(
      files.map((filePath) => lockFile(filePath).catch(() => undefined)),
    );
  };

  const handleLockFolder = async () => {
    const folder = await tauriClient.pickFolderForOrganize().catch(() => null);
    if (folder) {
      await lockFolder(folder).catch(() => undefined);
    }
  };

  const checkFastApiHealth = async (showRefreshState = false) => {
    if (showRefreshState) {
      setIsRefreshingDevHealth(true);
      setFastApiStatus("checking");
    }

    const url = "http://127.0.0.1:8000/health";

    try {
      const response = await fetch(url, {
        method: "GET",
        signal: AbortSignal.timeout(2000),
      });
      if (response.ok) {
        const data = (await response.json()) as {
          services?: Record<string, { ok: boolean; detail?: string }>;
        };
        const services = data?.services ?? {};
        setFastApiStatus(services["FastAPI"]?.ok ? "online" : "offline");
        if (showRefreshState) {
          setIsRefreshingDevHealth(false);
        }
        return;
      }
    } catch { }

    setFastApiStatus("offline");
    if (showRefreshState) {
      setIsRefreshingDevHealth(false);
    }
  };

  const slotConfigs = [
    { key: "chat" as const, label: "Chat / Vision", port: 8080 },
    { key: "embed" as const, label: "Embeddings", port: 8081 },
  ];

  const handleStartSlot = async (slot: "chat" | "embed") => {
    setStartingSlot(slot);
    try {
      await tauriClient.ensureLlamaServer(slot);
    } catch (e) {
      console.error(`[dev] ensureLlamaServer(${slot}) failed:`, e);
    } finally {
      setStartingSlot(null);
      void checkFastApiHealth();
    }
  };

  const checkSlotHealth = async (slot: string, port: number) => {
    setSlotHealth((prev) => ({ ...prev, [slot]: "checking…" }));
    try {
      const res = await fetch(`http://127.0.0.1:${port}/health`, {
        signal: AbortSignal.timeout(3000),
      });
      const data = (await res.json()) as { status?: string };
      setSlotHealth((prev) => ({
        ...prev,
        [slot]: data.status ?? (res.ok ? "ok" : `http ${res.status}`),
      }));
    } catch {
      setSlotHealth((prev) => ({ ...prev, [slot]: "unreachable" }));
    }
  };

  const runScanCycle = async () => {
    if (watchedFolders.length === 0 || isScanning) return;
    setIsScanning(true);
    try {
      const scanned = await Promise.all(
        watchedFolders.map((folderPath) =>
          tauriClient.readFolder({ folderPath }).catch(() => []),
        ),
      );
      scanned.flat().forEach((filePath) => {
        const fileName = filePath.split(/[\/\\]/).pop() ?? filePath;
        queueRef.current.enqueue(async () => {
          await processAutomationJob({
            filePath,
            fileName,
            contentPreview: "",
          });
        });
      });
      setLastScanTime(new Date().toISOString());
    } finally {
      setIsScanning(false);
    }
  };

  const refreshWatcherFileCounts = async () => {
    if (!isRunning || watchedFolders.length === 0) {
      setWatcherFolderStats([]);
      return;
    }

    setIsCountingWatcherFiles(true);
    try {
      const counts = await Promise.all(
        watchedFolders.map(async (folderPath) => {
          const files = await tauriClient
            .readFolder({ folderPath })
            .catch(() => []);
          return {
            folderPath,
            fileCount: files.length,
          };
        }),
      );
      setWatcherFolderStats(counts);
    } finally {
      setIsCountingWatcherFiles(false);
    }
  };

  useEffect(() => {
    void refreshWatcherFileCounts();
  }, [isRunning, watchedFolders]);

  useEffect(() => {
    void tauriClient
      .saveAutomationConfig({
        auto_organize_enabled: isRunning,
        watched_folders: watchedFolders,
        scan_interval_seconds: 60,
      })
      .catch(() => undefined);
  }, [isRunning, watchedFolders]);

  const totalWatchedFiles = useMemo(
    () => watcherFolderStats.reduce((sum, item) => sum + item.fileCount, 0),
    [watcherFolderStats],
  );

  const authStatus = useAuthStore((state) => state.status);
  const authError = useAuthStore((state) => state.error);
  const profile = useAuthStore((state) => state.profile);
  const accessToken = useAuthStore((state) => state.accessToken);
  const expiresAt = useAuthStore((state) => state.expiresAt);
  const initializeAuth = useAuthStore((state) => state.initialize);
  const login = useAuthStore((state) => state.login);
  const logout = useAuthStore((state) => state.logout);

  useEffect(() => {
    void initializeAuth();
  }, [initializeAuth]);

  useEffect(() => {
    void hydrateLocks().catch(() => undefined);
  }, [hydrateLocks]);

  useEffect(() => {
    if (!import.meta.env.DEV) {
      return;
    }

    void checkFastApiHealth();
    const interval = setInterval(() => {
      void checkFastApiHealth();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const isLoggedIn = useMemo(() => {
    if (!accessToken) {
      return false;
    }
    return !googleAuthService.isExpired(expiresAt);
  }, [accessToken, expiresAt]);

  const profileInitial = (
    profile?.name?.trim()?.charAt(0) || "G"
  ).toUpperCase();

  return (
    <div className="space-y-7 pb-12">
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
          Configuration
        </p>
        <h2 className="font-syne text-2xl font-black uppercase tracking-tight">
          Settings
        </h2>
      </div>

      <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-card p-5 shadow-xs ring-1 ring-border/70">
        <div className="flex items-center gap-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            Google Account
          </p>
        </div>
        <div className="flex w-full items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => {
              if (!isLoggedIn) {
                void login();
              }
            }}
            className={cn(
              "flex min-w-0 items-center gap-3 text-left transition-opacity",
              !isLoggedIn && "hover:opacity-90",
            )}
            disabled={isLoggedIn || authStatus === "loading"}
          >
            {isLoggedIn && profile?.picture ? (
              <img
                src={profile.picture}
                alt={profile.name}
                className="h-12 w-12 rounded-full border-2 border-primary/30 object-cover"
              />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-muted text-sm font-semibold text-foreground">
                {isLoggedIn ? (
                  profileInitial
                ) : (
                  <UserCircle2 className="h-6 w-6 text-muted-foreground" />
                )}
              </div>
            )}

            <div className="min-w-0">
              <p className="truncate font-semibold">
                {isLoggedIn
                  ? (profile?.name ?? "Google account")
                  : "Not connected"}
              </p>
              <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
                <Mail className="h-3 w-3" />
                {isLoggedIn
                  ? profile?.email || "No email available"
                  : "Connect to Google to show profile"}
              </p>
            </div>
          </button>

          <div className="flex items-center gap-2">
            {isLoggedIn ? (
              <Button variant="outline" onClick={() => void logout()}>
                Disconnect
              </Button>
            ) : (
              <Button
                onClick={() => void login()}
                disabled={authStatus === "loading"}
              >
                {authStatus === "loading" ? "Connecting..." : "Connect Google"}
              </Button>
            )}
          </div>
        </div>
      </section>

      {authError && <p className="text-xs text-destructive">{authError}</p>}

      <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-card p-5 shadow-xs ring-1 ring-border/70">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            Configuration
          </p>
          <h3 className="font-semibold">Manage Settings</h3>
        </div>
        <Button
          variant="outline"
          className="h-10 gap-2"
          onClick={() => setOpen(true)}
        >
          <SlidersHorizontal className="h-4 w-4" /> Open
        </Button>
      </section>

      <section className="space-y-5 rounded-2xl bg-card p-5 shadow-xs ring-1 ring-border/70">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              Automation
            </p>
            <h3 className="font-semibold">Auto Organize</h3>
          </div>
          <button
            type="button"
            onClick={() => setRunning(!isRunning)}
            role="switch"
            aria-pressed={isRunning}
            aria-checked={isRunning}
            className={cn(
              "inline-flex items-center gap-2 rounded-full px-2 py-1 transition-colors",
              isRunning
                ? "bg-primary/15 text-primary"
                : "bg-muted text-muted-foreground",
            )}
          >
            <span
              className={cn(
                "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
                isRunning ? "bg-primary" : "bg-muted-foreground/30",
              )}
            >
              <span
                className={cn(
                  "h-4 w-4 rounded-full bg-background shadow-sm transition-transform",
                  isRunning ? "translate-x-4" : "translate-x-0.5",
                )}
              />
            </span>
            <span className="w-8 text-left text-xs font-black uppercase tracking-widest">
              {isRunning ? "On" : "Off"}
            </span>
          </button>
        </div>

        <div className="flex items-center justify-between border-t border-border/70 pt-4">
          <div>
            <p className="text-xs font-semibold">Manual Scan</p>
            <p className="text-xs text-muted-foreground">
              {watchedFolders.length === 0
                ? "Add watched folders first"
                : `Scan ${watchedFolders.length} folder${watchedFolders.length !== 1 ? "s" : ""} now`}
            </p>
          </div>
          <Button
            variant="outline"
            className="h-9 gap-2"
            onClick={() => void runScanCycle()}
            disabled={isScanning || watchedFolders.length === 0}
          >
            <RefreshCw
              className={cn("h-3.5 w-3.5", isScanning && "animate-spin")}
            />
            {isScanning ? "Scanning..." : "Scan Now"}
          </Button>
        </div>

        {isRunning && (
          <div className="space-y-3 rounded-lg border border-dashed border-border bg-muted/20 p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  Mock
                </p>
                <h4 className="text-sm font-semibold">Watcher File Count</h4>
              </div>
              <Button
                variant="ghost"
                className="h-8 px-3 text-xs"
                onClick={() => void refreshWatcherFileCounts()}
                disabled={isCountingWatcherFiles}
              >
                {isCountingWatcherFiles ? "Refreshing..." : "Refresh"}
              </Button>
            </div>

            <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
              Watching {watchedFolders.length} folder
              {watchedFolders.length !== 1 ? "s" : ""} with {totalWatchedFiles}{" "}
              file
              {totalWatchedFiles !== 1 ? "s" : ""} total.
            </div>

            {watchedFolders.length === 0 ? (
              <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
                No watched folders configured.
              </div>
            ) : (
              <div className="space-y-2">
                {watcherFolderStats.map((item) => (
                  <div
                    key={item.folderPath}
                    className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2 text-xs"
                  >
                    <span
                      className="min-w-0 truncate font-mono text-muted-foreground"
                      title={item.folderPath}
                    >
                      {item.folderPath}
                    </span>
                    <span className="ml-3 shrink-0 font-black text-foreground">
                      {item.fileCount} file{item.fileCount !== 1 ? "s" : ""}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      <section className="space-y-5 rounded-2xl bg-card p-5 shadow-xs ring-1 ring-border/70">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              Security
            </p>
            <h3 className="font-semibold">Locked Paths</h3>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="h-9 gap-2"
              onClick={() => void handleLockFiles()}
            >
              <FileX2 className="h-3.5 w-3.5" /> Lock File
            </Button>
            <Button
              variant="outline"
              className="h-9 gap-2"
              onClick={() => void handleLockFolder()}
            >
              <FolderLock className="h-3.5 w-3.5" /> Lock Folder
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-2 rounded-full bg-muted px-3 py-1.5 w-fit">
          <ShieldCheck className="h-3.5 w-3.5 text-primary" />
          <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            {lockedPaths.length} locked path
            {lockedPaths.length !== 1 ? "s" : ""} — blocked from AI
          </span>
        </div>

        <div className="space-y-2">
          {lockedPaths.length === 0 ? (
            <div className="rounded-lg border-2 border-dashed border-border py-8 text-center text-sm text-muted-foreground">
              No locked paths. Files and folders added here will never be sent
              to AI.
            </div>
          ) : (
            lockedPaths.map((p) => (
              <div
                key={p}
                className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm"
              >
                <span
                  className="min-w-0 truncate font-mono text-foreground"
                  title={p}
                >
                  {p}
                </span>
                <button
                  type="button"
                  onClick={() => unlockPath(p)}
                  className="ml-3 shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      </section>

      {import.meta.env.DEV && (
        <section className="space-y-5 rounded-2xl border border-primary/20 bg-primary/5 p-5 shadow-xs ring-1 ring-primary/20">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="mb-1 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-primary opacity-80">
                <Terminal className="h-3 w-3" /> Developer Mode
              </p>
              <h3 className="font-semibold text-primary">Debug Environment</h3>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                className="h-9 gap-2 border-primary/20 shadow-xs hover:bg-primary/10"
                onClick={() => void checkFastApiHealth(true)}
                disabled={isRefreshingDevHealth}
              >
                <RefreshCw
                  className={cn(
                    "h-3.5 w-3.5",
                    isRefreshingDevHealth && "animate-spin",
                  )}
                />
                Refresh
              </Button>
              <Button
                variant="default"
                className="h-9 gap-2 shadow-xs"
                onClick={() => navigate("/settings/api-logs")}
              >
                <Activity className="h-3.5 w-3.5" /> Frontend API Logs
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-primary/10 pt-4">
            <div className="flex items-center justify-between rounded-lg border border-primary/10 bg-background/50 px-3 py-2.5">
              <div className="flex items-center gap-2">
                <Server className="h-4 w-4 text-primary/70" />
                <span className="text-sm font-medium">FastAPI Backend</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span
                  className={cn(
                    "h-2 w-2 rounded-full",
                    fastApiStatus === "checking"
                      ? "bg-muted-foreground animate-pulse"
                      : fastApiStatus === "online"
                        ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]"
                        : "bg-destructive",
                  )}
                />
                <span
                  className={cn(
                    "text-xs uppercase tracking-wider font-bold",
                    fastApiStatus === "online"
                      ? "text-green-600 dark:text-green-500"
                      : fastApiStatus === "offline"
                        ? "text-destructive"
                        : "text-muted-foreground",
                  )}
                >
                  {fastApiStatus}
                </span>
              </div>
            </div>

            {slotConfigs.map(({ key, label, port }) => (
              <div key={key} className="flex items-center justify-between rounded-lg border border-primary/10 bg-background/50 px-3 py-2.5">
                <div className="flex items-center gap-2 min-w-0">
                  <Server className="h-4 w-4 shrink-0 text-primary/70" />
                  <span className="text-sm font-medium truncate">{label}</span>
                  <span className="text-[10px] font-mono text-muted-foreground">:{port}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {slotHealth[key] && (
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {slotHealth[key]}
                    </span>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 gap-1 text-xs border-primary/20"
                    onClick={() => void checkSlotHealth(key, port)}
                  >
                    <Activity className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 gap-1 text-xs border-primary/20"
                    onClick={() => void handleStartSlot(key)}
                    disabled={startingSlot === key}
                  >
                    <Play className={cn("h-3 w-3", startingSlot === key && "animate-pulse")} />
                    {startingSlot === key ? "Starting…" : "Start"}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <SettingsManagementDialogs
        open={open}
        sections={["default-folder", "watched-folders", "categories"]}
        onClose={() => setOpen(false)}
      />
    </div>
  );
}
