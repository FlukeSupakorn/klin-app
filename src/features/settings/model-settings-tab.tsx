import { useCallback, useEffect, useMemo, useState } from "react";
import { pushAppNotification } from "@/stores/use-app-notifications";
import {
  BrainCircuit,
  CheckCircle2,
  Download,
  HardDrive,
  Image as ImageIcon,
  Trash2,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { IS_DEV } from "@/lib/env";
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
import { useDownloadQueueStore } from "@/stores/use-download-queue-store";

type LoadState = "loading" | "ready" | "error";

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) {
    return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
  }
  return `${Math.round(bytes / 1024 / 1024)} MB`;
}

interface MmprojRowProps {
  filename: string;
  sizeBytes: number;
  isInstalled: boolean;
  isDownloading: boolean;
  downloadProgress: number;
  queuePosition: number;
  isDeleting: boolean;
  onDownload: () => void;
  onDelete: () => void;
}

function MmprojRow({
  filename,
  sizeBytes,
  isInstalled,
  isDownloading,
  downloadProgress,
  queuePosition,
  isDeleting,
  onDownload,
  onDelete,
}: MmprojRowProps) {
  const isQueued = queuePosition > 0;
  return (
    <div className="mt-3 rounded-[10px] border border-dashed border-border/70 bg-muted/30 px-3 py-2.5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <div
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[7px]"
            style={{ background: "var(--muted)" }}
          >
            <ImageIcon className="h-3 w-3 text-muted-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[11.5px] font-bold text-foreground">
              Image understanding (mmproj){" "}
              <span className="ml-1 font-mono text-[10px] font-normal text-muted-foreground">
                {formatBytes(sizeBytes)}
              </span>
            </div>
            <div className="truncate font-mono text-[9.5px] text-muted-foreground">
              {filename}
            </div>
          </div>
        </div>
        <div className="shrink-0">
          {!isInstalled && !isDownloading && !isQueued && (
            <Button
              size="sm"
              variant="outline"
              className="h-6 gap-1 px-2 text-[10.5px] font-bold"
              onClick={onDownload}
            >
              <Download className="h-3 w-3" />
              Add
            </Button>
          )}
          {isInstalled && !isDownloading && !isQueued && (
            <Button
              size="sm"
              variant="ghost"
              className="h-6 gap-1 px-2 text-[10.5px] font-bold text-muted-foreground hover:text-destructive"
              disabled={isDeleting}
              onClick={onDelete}
            >
              <Trash2 className="h-3 w-3" />
              {isDeleting ? "Removing…" : "Remove"}
            </Button>
          )}
          {isDownloading && (
            <span className="text-[10.5px] font-semibold text-muted-foreground">
              {downloadProgress}%
            </span>
          )}
          {isQueued && !isDownloading && (
            <span
              className="rounded-full px-1.5 py-0.5 text-[10px] font-bold"
              style={{ background: "var(--muted)", color: "var(--muted-foreground)" }}
            >
              #{queuePosition}
            </span>
          )}
        </div>
      </div>
      {isDownloading && (
        <Progress value={downloadProgress} className="mt-2 h-1" />
      )}
      {isInstalled && (
        <div className="mt-1.5 text-[10px] text-muted-foreground">
          Installed — used automatically when this model is active.
        </div>
      )}
      {!isInstalled && !isDownloading && !isQueued && (
        <div className="mt-1.5 text-[10px] text-muted-foreground">
          Optional. Without it, this model still works for text but skips images.
        </div>
      )}
    </div>
  );
}

interface ModelCardProps {
  model: ModelEntry;
  isInstalled: boolean;
  isActive: boolean;
  isSwitching: boolean;
  isDeleting: boolean;
  isDownloading: boolean;
  downloadProgress: number;
  /** 1-based queue position, 0 if not queued. */
  queuePosition: number;
  compatLabel: string;
  onUse: () => void;
  onDownload: () => void;
  onDelete: () => void;
  mmprojRow: React.ReactNode;
}

function ModelCard({
  model,
  isInstalled,
  isActive,
  isSwitching,
  isDeleting,
  isDownloading,
  downloadProgress,
  queuePosition,
  compatLabel,
  onUse,
  onDownload,
  onDelete,
  mmprojRow,
}: ModelCardProps) {
  const isQueued = queuePosition > 0;
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

      {/* Action row */}
      <div className="mt-3 flex items-center justify-between gap-2">
        <div>
          {isInstalled && !isActive && !isDownloading && !isQueued && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 gap-1.5 px-2.5 text-[11.5px] font-bold text-muted-foreground hover:text-destructive"
              disabled={isDeleting || isSwitching}
              onClick={onDelete}
            >
              <Trash2 className="h-3 w-3" />
              {isDeleting ? "Deleting…" : "Delete"}
            </Button>
          )}
        </div>
        <div>
          {!isInstalled && !isDownloading && !isQueued && (
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
          {isInstalled && !isActive && !isDownloading && !isQueued && (
            <Button
              size="sm"
              className="h-7 gap-1.5 px-3 text-[12px] font-bold"
              disabled={isSwitching || isDeleting}
              onClick={onUse}
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
          {isQueued && !isDownloading && (
            <span
              className="rounded-full px-2 py-0.5 text-[11px] font-bold"
              style={{ background: "var(--muted)", color: "var(--muted-foreground)" }}
            >
              Queued — #{queuePosition}
            </span>
          )}
        </div>
      </div>

      {/* mmproj sub-row */}
      {mmprojRow}
    </div>
  );
}

export function ModelSettingsTab() {
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [modelConfig, setModelConfig] = useState<ModelConfigDto | null>(null);
  const [installed, setInstalled] = useState<InstalledModelDto[]>([]);
  const [specs, setSpecs] = useState<SystemSpecsDto | null>(null);
  const [switchingId, setSwitchingId] = useState<string | null>(null);
  const [deletingFilename, setDeletingFilename] = useState<string | null>(null);

  const { downloadQueue } = useModelDownload();
  const queueModels = useDownloadQueueStore((s) => s.queue);
  const currentDownload = useDownloadQueueStore((s) => s.current);
  const currentProgress = useDownloadQueueStore((s) => s.progress);

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
        pushAppNotification({
          tone: "success",
          title: "Model switched",
          message: model.label,
          autoDismissMs: 3500,
        });
      } catch (err) {
        console.error("[settings] switch model failed", err);
        const message = err instanceof Error ? err.message : String(err);
        pushAppNotification({
          tone: "error",
          title: "Switch failed",
          message,
        });
        throw err;
      } finally {
        setSwitchingId(null);
      }
    },
    [installedFilenames]
  );

  const handleDownload = useCallback(
    async (model: ModelEntry) => {
      try {
        await downloadQueue([model]);
        const updated = await tauriClient.listInstalledModels();
        setInstalled(updated);
        await handleUseModel(model);
      } catch (err) {
        console.error("[settings] download/switch failed", err);
        const message = err instanceof Error ? err.message : String(err);
        pushAppNotification({
          tone: "error",
          title: `Download failed for ${model.label}`,
          message,
        });
      }
    },
    [downloadQueue, handleUseModel]
  );

  const handleDownloadMmproj = useCallback(
    async (chatModel: ModelEntry) => {
      const mmproj = getImageModelForChat(chatModel);
      try {
        await downloadQueue([mmproj]);
        const updated = await tauriClient.listInstalledModels();
        setInstalled(updated);
        // If the chat model is currently active, point the config at the new mmproj.
        if (chatModel.filename === activeChatFilename) {
          await tauriClient.writeModelConfig("mmproj", mmproj.filename, mmproj.sha256);
        }
        pushAppNotification({
          tone: "success",
          title: "Image model installed",
          message: chatModel.label,
          autoDismissMs: 3500,
        });
      } catch (err) {
        console.error("[settings] mmproj download failed", err);
        const message = err instanceof Error ? err.message : String(err);
        pushAppNotification({
          tone: "error",
          title: `mmproj download failed for ${chatModel.label}`,
          message,
        });
      }
    },
    [downloadQueue, activeChatFilename]
  );

  const handleDelete = useCallback(
    async (filename: string, label: string) => {
      setDeletingFilename(filename);
      try {
        await tauriClient.deleteInstalledModel(filename);
        const updated = await tauriClient.listInstalledModels();
        setInstalled(updated);
        pushAppNotification({
          tone: "success",
          title: "Removed",
          message: label,
          autoDismissMs: 3500,
        });
      } catch (err) {
        console.error("[settings] delete failed", err);
        const message = err instanceof Error ? err.message : String(err);
        pushAppNotification({
          tone: "error",
          title: `Delete failed: ${label}`,
          message,
        });
      } finally {
        setDeletingFilename(null);
      }
    },
    []
  );


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
      {IS_DEV && (
        <div className="flex items-start gap-2.5 rounded-[11px] border border-border bg-muted/50 px-3.5 py-3">
          <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-amber-400" />
          <p className="text-[12px] leading-relaxed text-muted-foreground">
            <span className="font-bold text-foreground">Development mode:</span>{" "}
            Downloads are mocked and the live llama-server still uses the model
            set by <code className="font-mono">KLIN_CHAT_MODEL_PATH</code>.
            Switching here updates the saved config so prod builds will pick it
            up, but won&apos;t change the running model in dev.
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
          const isThisDownloading = currentDownload?.id === model.id;
          const queueIdx = queueModels.findIndex((m) => m.id === model.id);
          const queuePosition = queueIdx < 0 ? 0 : queueIdx + 1;
          const compatLabel = assessCompatibility(model, specs);

          const mmproj = getImageModelForChat(model);
          const mmprojInstalled = installedFilenames.has(mmproj.filename);
          const mmprojDownloading = currentDownload?.filename === mmproj.filename;
          const mmprojQueueIdx = queueModels.findIndex((m) => m.filename === mmproj.filename);
          const mmprojQueuePosition = mmprojQueueIdx < 0 ? 0 : mmprojQueueIdx + 1;

          return (
            <ModelCard
              key={model.id}
              model={model}
              isInstalled={installed}
              isActive={active}
              isSwitching={switchingId === model.id}
              isDeleting={deletingFilename === model.filename}
              isDownloading={isThisDownloading}
              downloadProgress={isThisDownloading ? currentProgress : 0}
              queuePosition={queuePosition}
              compatLabel={compatLabel}
              onUse={() => void handleUseModel(model)}
              onDownload={() => void handleDownload(model)}
              onDelete={() => void handleDelete(model.filename, model.label)}
              mmprojRow={
                <MmprojRow
                  filename={mmproj.filename}
                  sizeBytes={mmproj.sizeBytes}
                  isInstalled={mmprojInstalled}
                  isDownloading={mmprojDownloading}
                  downloadProgress={mmprojDownloading ? currentProgress : 0}
                  queuePosition={mmprojQueuePosition}
                  isDeleting={deletingFilename === mmproj.filename}
                  onDownload={() => void handleDownloadMmproj(model)}
                  onDelete={() => void handleDelete(mmproj.filename, `${model.label} — image model`)}
                />
              }
            />
          );
        })}
      </div>
    </div>
  );
}
