import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  BrainCircuit,
  CheckCircle2,
  Download,
  HardDrive,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { tauriClient } from "@/services/tauri-client";
import type {
  InstalledModelDto,
  ModelConfigDto,
  SystemSpecsDto,
} from "@/types/ipc";
import {
  CHAT_MODELS,
  getImageModelForChat,
  type ModelEntry,
} from "@/features/model-download/available-models";
import { assessCompatibility } from "@/features/model-download/compatibility";
import { useModelDownload } from "@/features/model-download/use-model-download";

type LoadState = "loading" | "ready" | "error";

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) {
    return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
  }
  return `${Math.round(bytes / 1024 / 1024)} MB`;
}

interface ModelCardProps {
  model: ModelEntry;
  isInstalled: boolean;
  isActive: boolean;
  isSwitching: boolean;
  isDownloading: boolean;
  downloadProgress: number;
  compatLabel: string;
  isDev: boolean;
  onUse: () => void;
  onDownload: () => void;
}

function ModelCard({
  model,
  isInstalled,
  isActive,
  isSwitching,
  isDownloading,
  downloadProgress,
  compatLabel,
  isDev,
  onUse,
  onDownload,
}: ModelCardProps) {
  return (
    <div
      className={cn(
        "rounded-[12px] border border-border bg-card px-4 py-3.5",
        isActive && "border-primary/40 bg-primary/5"
      )}
    >
      {/* Top row: label + badges + size */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[13.5px] font-bold text-foreground">
              {model.label}
            </span>
            {isActive && (
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                style={{
                  background: "var(--primary-tint)",
                  color: "var(--primary)",
                }}
              >
                Active
              </span>
            )}
            {isInstalled && !isActive && (
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                style={{
                  background: "var(--success-tint)",
                  color: "var(--success)",
                }}
              >
                Installed
              </span>
            )}
          </div>
          <p className="mt-0.5 text-[12px] leading-relaxed text-muted-foreground">
            {model.description}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <div className="font-mono text-[12px] text-foreground">
            {formatBytes(model.sizeBytes)}
          </div>
          <div className="mt-0.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            {compatLabel}
          </div>
        </div>
      </div>

      {/* Filename row */}
      <div className="mt-2 flex items-center gap-1.5 text-[10px] text-muted-foreground">
        <HardDrive className="h-3 w-3 shrink-0" />
        <span className="truncate font-mono">{model.filename}</span>
      </div>

      {/* Progress bar (when downloading) */}
      {isDownloading && (
        <div className="mt-3 space-y-1">
          <Progress value={downloadProgress} className="h-1.5" />
          <div className="text-right font-mono text-[10px] text-muted-foreground">
            {downloadProgress}%
          </div>
        </div>
      )}

      {/* Action button */}
      <div className="mt-3 flex justify-end">
        {!isInstalled && !isDownloading && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 gap-1.5 px-3 text-[12px] font-bold"
            onClick={onDownload}
          >
            <Download className="h-3 w-3" />
            Download
          </Button>
        )}
        {isInstalled && !isActive && !isDownloading && (
          <Button
            size="sm"
            className="h-7 gap-1.5 px-3 text-[12px] font-bold"
            disabled={isDev || isSwitching}
            onClick={onUse}
            title={
              isDev
                ? "Model switching is disabled in development mode"
                : undefined
            }
          >
            {isSwitching ? "Switching…" : "Use this model"}
          </Button>
        )}
        {isInstalled && isActive && (
          <span className="flex items-center gap-1 text-[11.5px] font-semibold text-primary">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Active model
          </span>
        )}
        {isDownloading && (
          <span className="text-[11.5px] font-semibold text-muted-foreground">
            Downloading…
          </span>
        )}
      </div>
    </div>
  );
}

export function ModelSettingsTab() {
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [modelConfig, setModelConfig] = useState<ModelConfigDto | null>(null);
  const [installed, setInstalled] = useState<InstalledModelDto[]>([]);
  const [specs, setSpecs] = useState<SystemSpecsDto | null>(null);
  const [switchingId, setSwitchingId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const { rows, downloadQueue } = useModelDownload();

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [config, installedList, systemSpecs] = await Promise.all([
          tauriClient.readModelConfig(),
          tauriClient.listInstalledModels(),
          tauriClient.getSystemSpecs(),
        ]);
        if (cancelled) return;
        setModelConfig(config);
        setInstalled(installedList);
        setSpecs(systemSpecs);
        setLoadState("ready");
      } catch {
        if (!cancelled) setLoadState("error");
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const installedFilenames = useMemo(
    () => new Set(installed.map((m) => m.filename)),
    [installed]
  );

  const activeChatFilename = modelConfig?.models?.chat?.filename ?? null;

  const handleUseModel = useCallback(
    async (model: ModelEntry) => {
      setSwitchingId(model.id);
      try {
        await tauriClient.writeModelConfig(
          "chat",
          model.filename,
          model.sha256
        );
        const imageModel = getImageModelForChat(model);
        if (installedFilenames.has(imageModel.filename)) {
          await tauriClient.writeModelConfig(
            "mmproj",
            imageModel.filename,
            imageModel.sha256
          );
        }
        await tauriClient.stopLlamaServer("chat");
        setModelConfig((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            models: {
              ...prev.models,
              chat: { filename: model.filename, sha256: model.sha256 },
            },
          };
        });
        toast.success(`Switched to ${model.label}`);
      } catch {
        toast.error("Failed to switch model. Please try again.");
      } finally {
        setSwitchingId(null);
      }
    },
    [installedFilenames]
  );

  const handleDownload = useCallback(
    async (model: ModelEntry) => {
      setDownloadingId(model.id);
      try {
        await downloadQueue([model]);
        const updated = await tauriClient.listInstalledModels();
        setInstalled(updated);
        await handleUseModel(model);
      } catch {
        toast.error(`Download failed for ${model.label}`);
      } finally {
        setDownloadingId(null);
      }
    },
    [downloadQueue, handleUseModel]
  );

  const isDev = import.meta.env.DEV;

  if (loadState === "loading") {
    return (
      <div className="flex items-center justify-center p-10 text-[13px] text-muted-foreground">
        Loading models…
      </div>
    );
  }

  if (loadState === "error") {
    return (
      <div className="flex items-center justify-center p-10 text-[13px] text-destructive">
        Failed to load model configuration.
      </div>
    );
  }

  return (
    <div className="space-y-5 p-5">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <div
          className="flex h-8 w-8 items-center justify-center rounded-[10px]"
          style={{ background: "var(--primary)" }}
        >
          <BrainCircuit className="h-4 w-4 text-white" />
        </div>
        <div>
          <div className="text-[13px] font-extrabold text-foreground">
            AI Model
          </div>
          <div className="text-[11px] text-muted-foreground">
            Manage and switch the active local chat model
          </div>
        </div>
      </div>

      {/* Dev mode banner */}
      {isDev && (
        <div className="flex items-start gap-2.5 rounded-[11px] border border-border bg-muted/50 px-3.5 py-3">
          <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-amber-400" />
          <p className="text-[12px] leading-relaxed text-muted-foreground">
            <span className="font-bold text-foreground">Development mode:</span>{" "}
            The active model is set via the{" "}
            <code className="font-mono">KLIN_CHAT_MODEL_PATH</code> environment
            variable. Model switching is disabled. Downloads are still allowed.
          </p>
        </div>
      )}

      {/* Section heading */}
      <div className="text-[10.5px] font-extrabold uppercase tracking-widest text-muted-foreground">
        Available Chat Models
      </div>

      {/* Model cards */}
      <div className="space-y-3">
        {CHAT_MODELS.map((model) => {
          const installed = installedFilenames.has(model.filename);
          const active = model.filename === activeChatFilename;
          const chatRow = rows.chat;
          const isThisDownloading = downloadingId === model.id;
          const compatLabel = assessCompatibility(model, specs);

          return (
            <ModelCard
              key={model.id}
              model={model}
              isInstalled={installed}
              isActive={active}
              isSwitching={switchingId === model.id}
              isDownloading={isThisDownloading}
              downloadProgress={isThisDownloading ? chatRow.progress : 0}
              compatLabel={compatLabel}
              isDev={isDev}
              onUse={() => void handleUseModel(model)}
              onDownload={() => void handleDownload(model)}
            />
          );
        })}
      </div>
    </div>
  );
}
