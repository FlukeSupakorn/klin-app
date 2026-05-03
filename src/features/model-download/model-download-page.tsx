import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  Bot,
  ChevronDown,
  ChevronRight,
  Cpu,
  HardDrive,
  Image,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { CloseAppController } from "@/components/dialogs/close-app-controller";
import { logger } from "@/lib/logger";
import { cn } from "@/lib/utils";
import { tauriClient } from "@/services/tauri-client";
import type { SystemSpecsDto } from "@/types/ipc";
import {
  CHAT_MODELS,
  DEFAULT_CHAT_MODEL,
  EMBED_MODEL,
  getImageModelForChat,
  type ModelEntry,
} from "./available-models";
import { assessCompatibility } from "./compatibility";
import { useModelDownload } from "./use-model-download";

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) {
    return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
  }
  return `${Math.round(bytes / 1024 / 1024)} MB`;
}

function statusText(status: string, progress: number): string {
  if (status === "downloading") return `Downloading ${progress}%`;
  if (status === "verified") return "Verified";
  if (status === "done") return "Done";
  if (status === "error") return "Error";
  return "Pending";
}

function ModelRow({
  model,
  selected,
  disabled,
  optional,
  selectable,
  checked,
  onSelect,
  onCheckedChange,
  progress,
  status,
  specs,
}: {
  model: ModelEntry;
  selected?: boolean;
  disabled?: boolean;
  optional?: boolean;
  selectable?: boolean;
  checked?: boolean;
  onSelect?: () => void;
  onCheckedChange?: (checked: boolean) => void;
  progress: number;
  status: string;
  specs: SystemSpecsDto | null;
}) {
  const Icon = model.slot === "chat" ? Bot : model.slot === "embed" ? Cpu : Image;
  const canToggle = optional && status !== "downloading" && !disabled;
  const canSelect = selectable && status !== "downloading" && !disabled;
  const showChoiceDot = optional || selectable;

  return (
    <div
      role={optional ? "checkbox" : selectable ? "radio" : undefined}
      aria-checked={optional ? Boolean(checked) : selectable ? Boolean(selected) : undefined}
      tabIndex={canToggle || canSelect ? 0 : undefined}
      className={cn(
        "rounded-xl border border-border bg-muted/30 px-3.5 py-3 transition-all duration-200",
        !disabled && "hover:border-primary/30",
        (canToggle || canSelect) && "cursor-pointer",
        (selected || checked) && "border-primary/40 bg-primary/5",
        disabled && "opacity-70"
      )}
      onClick={disabled ? undefined : optional ? () => onCheckedChange?.(!checked) : onSelect}
      onKeyDown={(event) => {
        if (!(canToggle || canSelect) || (event.key !== "Enter" && event.key !== " ")) return;
        event.preventDefault();
        if (optional) onCheckedChange?.(!checked);
        if (selectable) onSelect?.();
      }}
    >
      <div className="flex items-start gap-3">
        {showChoiceDot ? (
          <div
            className={cn(
              "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors",
              (checked || selected) ? "border-primary bg-primary/10" : "border-border bg-background"
            )}
          >
            {(checked || selected) && <div className="h-2 w-2 rounded-full bg-primary" />}
          </div>
        ) : (
          <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        )}

        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-semibold text-foreground">{model.label}</p>
                {model.locked && <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">{model.description}</p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-xs font-mono text-foreground">{formatBytes(model.sizeBytes)}</p>
              <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                {statusText(status, progress)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
            <HardDrive className="h-3 w-3" />
            <span className="truncate">{model.filename}</span>
            <span className="shrink-0 text-primary">{assessCompatibility(model, specs)}</span>
          </div>
          <Progress value={progress} className="h-1" />
        </div>
      </div>
    </div>
  );
}

export function ModelDownloadPage() {
  const navigate = useNavigate();
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [selectedChatId, setSelectedChatId] = useState(DEFAULT_CHAT_MODEL.id);
  const [includeImages, setIncludeImages] = useState(false);
  const [specs, setSpecs] = useState<SystemSpecsDto | null>(null);
  const { rows, isDownloading, error, downloadQueue, retry } = useModelDownload();

  useEffect(() => {
    let cancelled = false;
    void tauriClient.getSystemSpecs().then((value) => {
      if (!cancelled) setSpecs(value);
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  const selectedChat = useMemo(
    () => CHAT_MODELS.find((model) => model.id === selectedChatId) ?? DEFAULT_CHAT_MODEL,
    [selectedChatId]
  );

  const selectedImageModel = useMemo(
    () => getImageModelForChat(selectedChat),
    [selectedChat]
  );

  useEffect(() => {
    logger.info(
      `[model-download] image model paired with ${selectedChat.filename}: ${selectedImageModel.filename} from ${selectedImageModel.url}`
    );
  }, [selectedChat.filename, selectedImageModel.filename, selectedImageModel.url]);

  useEffect(() => {
    logger.info(
      includeImages
        ? `[model-download] image understanding model selected: ${selectedImageModel.filename}`
        : "[model-download] image understanding model not selected"
    );
  }, [includeImages, selectedImageModel.filename]);

  const queue = useMemo(() => {
    const models = [selectedChat, EMBED_MODEL];
    if (includeImages) models.push(selectedImageModel);
    return models;
  }, [includeImages, selectedChat, selectedImageModel]);

  const handleDownload = async () => {
    retry();
    if (!includeImages) {
      logger.info("[model-download] skipping image understanding model download");
    }
    await downloadQueue(queue);
    navigate("/onboarding", { replace: true });
  };

  const advancedModels = CHAT_MODELS.filter((model) => !model.isDefault);
  const chatRowState = (model: ModelEntry) => {
    if (model.id !== selectedChatId) {
      return { progress: 0, status: "pending" };
    }
    return rows.chat;
  };

  return (
    <div className="min-h-screen bg-background px-4 py-8 md:py-10">
      <div className="mx-auto flex w-full max-w-lg flex-col gap-6">
        <div className="space-y-1.5">
          <h2 className="font-syne text-2xl font-black uppercase tracking-tight text-foreground">Download AI Models</h2>
          <p className="text-sm text-muted-foreground leading-relaxed text-pretty">
            KLIN needs local AI models before setup can continue. Downloads are saved to your app data folder and reused on future launches.
          </p>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-mono text-muted-foreground uppercase tracking-widest">
            Chat model
          </label>
          <ModelRow
            model={DEFAULT_CHAT_MODEL}
            selected={selectedChatId === DEFAULT_CHAT_MODEL.id}
            selectable
            disabled={isDownloading && selectedChatId !== DEFAULT_CHAT_MODEL.id}
            onSelect={() => setSelectedChatId(DEFAULT_CHAT_MODEL.id)}
            progress={chatRowState(DEFAULT_CHAT_MODEL).progress}
            status={chatRowState(DEFAULT_CHAT_MODEL).status}
            specs={specs}
          />
          <button
            type="button"
            onClick={() => setAdvancedOpen((open) => !open)}
            className="flex w-full items-center gap-2 rounded-xl border border-border bg-transparent px-3.5 py-2 text-left text-xs font-mono uppercase tracking-widest text-muted-foreground transition-all duration-200 hover:border-primary/30 hover:text-foreground"
          >
            {advancedOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            Advanced
          </button>
          {advancedOpen && (
            <div className="space-y-1.5" role="radiogroup" aria-label="Chat model choices">
              {advancedModels.map((model) => (
                <ModelRow
                  key={model.id}
                  model={model}
                  selected={model.id === selectedChatId}
                  selectable
                  disabled={isDownloading && model.id !== selectedChatId}
                  onSelect={() => setSelectedChatId(model.id)}
                  progress={chatRowState(model).progress}
                  status={chatRowState(model).status}
                  specs={specs}
                />
              ))}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <label className="text-xs font-mono text-muted-foreground uppercase tracking-widest">
            Embed model
          </label>
          <ModelRow
            model={EMBED_MODEL}
            disabled
            progress={rows.embed.progress}
            status={rows.embed.status}
            specs={specs}
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs font-mono text-muted-foreground uppercase tracking-widest">
            Optional model
          </label>
          <ModelRow
            model={selectedImageModel}
            optional
            selected={includeImages}
            checked={includeImages}
            onCheckedChange={setIncludeImages}
            progress={rows.mmproj.progress}
            status={rows.mmproj.status}
            specs={specs}
          />
        </div>

        {error && (
          <div className="flex items-center gap-2 text-destructive text-xs">
            <AlertCircle className="w-3.5 h-3.5" />
            {error}
          </div>
        )}

        <Button
          onClick={handleDownload}
          disabled={isDownloading}
          className="w-full font-semibold"
        >
          {isDownloading ? "Downloading..." : "Download & Continue"}
        </Button>
        <CloseAppController mode="quit-immediately" />
      </div>
    </div>
  );
}
