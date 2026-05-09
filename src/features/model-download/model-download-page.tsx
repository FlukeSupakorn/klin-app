import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  Check,
  ChevronDown,
  Cpu,
  Download,
  Hash,
  Image,
  Lock,
  MessageSquare,
  Server,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { CloseAppController } from "@/components/dialogs/close-app-controller";
import { logger } from "@/lib/logger";
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

type TagTone = "blue" | "green" | "amber" | "purple" | "gray" | "red";

interface TagSpec {
  label: string;
  color: TagTone;
}

const TAG_COLORS: Record<TagTone, { bg: string; color: string }> = {
  blue: { bg: "rgba(15,98,254,.1)", color: "#0F62FE" },
  green: { bg: "rgba(16,185,129,.1)", color: "#10b981" },
  amber: { bg: "rgba(245,158,11,.1)", color: "#d97706" },
  purple: { bg: "rgba(139,92,246,.1)", color: "#8b5cf6" },
  gray: { bg: "#eef0f8", color: "#6b7a9a" },
  red: { bg: "rgba(239,68,68,.08)", color: "#ef4444" },
};

function TagPill({ label, color, size = "xs" }: { label: string; color: TagTone; size?: "xs" | "sm" }) {
  const style = TAG_COLORS[color] ?? TAG_COLORS.blue;
  return (
    <span
      style={{
        fontSize: size === "xs" ? 9.5 : 10.5,
        fontWeight: 800,
        padding: size === "xs" ? "2px 7px" : "3px 9px",
        borderRadius: 10,
        background: style.bg,
        color: style.color,
        letterSpacing: ".06em",
        textTransform: "uppercase",
        whiteSpace: "nowrap",
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
      }}
    >
      {label}
    </span>
  );
}

function ProgressBar({ pct, color = "#0F62FE" }: { pct: number; color?: string }) {
  return (
    <div style={{ height: 5, borderRadius: 3, background: "#e4eafc", overflow: "hidden", position: "relative" }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          width: `${pct}%`,
          background: color,
          borderRadius: 3,
          transition: "width .3s",
        }}
      />
    </div>
  );
}

interface ModelCardProps {
  name: string;
  description: string;
  filename: string;
  sizeLabel: string;
  statusLabel: string;
  statusTone: TagTone;
  tags?: TagSpec[];
  recommended?: boolean;
  optional?: boolean;
  locked?: boolean;
  selected?: boolean;
  onSelect?: () => void;
  disabled?: boolean;
  progress?: number;
  showProgress?: boolean;
  icon?: React.ReactNode;
  showAdvancedToggle?: boolean;
  advancedOpen?: boolean;
  onToggleAdvanced?: () => void;
  advancedSection?: React.ReactNode;
}

function ModelCard({
  name,
  description,
  filename,
  sizeLabel,
  statusLabel,
  statusTone,
  tags = [],
  recommended,
  optional,
  locked,
  selected,
  onSelect,
  disabled,
  progress = 0,
  showProgress = true,
  icon,
  showAdvancedToggle,
  advancedOpen,
  onToggleAdvanced,
  advancedSection,
}: ModelCardProps) {
  const clickable = Boolean(onSelect) && !locked && !disabled;
  return (
    <div
      onClick={() => (clickable ? onSelect?.() : undefined)}
      style={{
        background: "#fff",
        borderRadius: 14,
        border: `1.5px solid ${selected ? "#0F62FE" : "#e4eafc"}`,
        boxShadow: selected
          ? "0 0 0 3px rgba(15,98,254,.10),0 2px 8px rgba(15,98,254,.07)"
          : "0 2px 8px rgba(15,98,254,.07)",
        padding: "14px 16px",
        cursor: disabled ? "not-allowed" : clickable ? "pointer" : "default",
        transition: "all .2s",
        position: "relative",
        overflow: "hidden",
        opacity: disabled ? 0.7 : 1,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        {locked ? (
          <div style={{ width: 32, height: 32, borderRadius: 9, background: "rgba(16,185,129,.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            {icon}
          </div>
        ) : optional ? (
          <div
            style={{
              width: 20,
              height: 20,
              borderRadius: "50%",
              border: `2px solid ${selected ? "#0F62FE" : "#a8b4cc"}`,
              background: selected ? "#0F62FE" : "transparent",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              marginTop: 2,
              transition: "all .15s",
            }}
          >
            {selected && <Check className="h-3 w-3" style={{ color: "#fff" }} />}
          </div>
        ) : (
          <div
            style={{
              width: 20,
              height: 20,
              borderRadius: "50%",
              border: `2px solid ${selected ? "#0F62FE" : "#a8b4cc"}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              marginTop: 2,
              transition: "all .15s",
            }}
          >
            {selected && <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#0F62FE" }} />}
          </div>
        )}

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 6, flexWrap: "wrap", rowGap: 5 }}>
            <span style={{ fontSize: 14, fontWeight: 800, color: "#181e35", letterSpacing: "-0.2px", lineHeight: 1.3 }}>
              {name}
            </span>
            {recommended && <TagPill label="Recommended" color="blue" size="xs" />}
            {locked && <TagPill label="Required" color="green" size="xs" />}
            {optional && <TagPill label="Optional" color="amber" size="xs" />}
          </div>
          <div style={{ fontSize: 12, color: "#6b7a9a", lineHeight: 1.55, marginBottom: 10 }}>{description}</div>

          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 9px", borderRadius: 7, background: "#f4f7ff", border: "1px solid #e4eafc" }}>
              <Server className="h-3 w-3" style={{ color: "#a8b4cc" }} />
              <span style={{ fontSize: 10.5, fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, color: "#6b7a9a" }}>
                {filename}
              </span>
            </div>
            {tags.map((tag) => (
              <TagPill key={`${name}-${tag.label}`} label={tag.label} color={tag.color} size="xs" />
            ))}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 5, flexShrink: 0, marginLeft: 6 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: "#181e35", fontFamily: "'JetBrains Mono', monospace", letterSpacing: "-0.3px" }}>
            {sizeLabel}
          </div>
          <TagPill label={statusLabel} color={statusTone} size="xs" />
        </div>
      </div>

      {showProgress && (
        <div style={{ marginTop: 12 }}>
          <ProgressBar pct={progress} color={statusLabel === "Ready" ? "#10b981" : "#0F62FE"} />
        </div>
      )}

      {showAdvancedToggle && onToggleAdvanced && (
        <button
          onClick={(event) => {
            event.stopPropagation();
            onToggleAdvanced();
          }}
          style={{
            marginTop: 12,
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "6px 11px",
            borderRadius: 9,
            background: advancedOpen ? "rgba(15,98,254,.11)" : "#f4f7ff",
            border: "1px solid #e4eafc",
            fontSize: 11.5,
            fontWeight: 700,
            color: advancedOpen ? "#0F62FE" : "#6b7a9a",
            letterSpacing: ".04em",
            textTransform: "uppercase",
          }}
        >
          <div style={{ transition: "transform .2s", transform: advancedOpen ? "rotate(180deg)" : "none" }}>
            <ChevronDown className="h-3 w-3" />
          </div>
          Advanced
        </button>
      )}
      {advancedOpen && advancedSection}
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) {
    return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
  }
  return `${Math.round(bytes / 1024 / 1024)} MB`;
}

function statusText(status: string, optional: boolean, selected: boolean): string {
  if (optional && !selected) return "Skipped";
  if (status === "downloading") return "Downloading";
  if (status === "verified" || status === "done") return "Ready";
  if (status === "error") return "Error";
  return "Pending";
}

function statusTone(label: string): TagTone {
  if (label === "Downloading") return "blue";
  if (label === "Ready") return "green";
  if (label === "Error") return "red";
  return "gray";
}

function compatibilityTone(label: string): TagTone {
  const lower = label.toLowerCase();
  if (lower.includes("not recommended")) return "red";
  if (lower.includes("needs") || lower.includes("slow") || lower.includes("ram")) return "purple";
  if (lower.includes("optional")) return "amber";
  return "green";
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

  const totalBytes = selectedChat.sizeBytes
    + EMBED_MODEL.sizeBytes
    + (includeImages ? selectedImageModel.sizeBytes : 0);
  const totalLabel = `${(totalBytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  const selectedCount = 2 + (includeImages ? 1 : 0);
  const chatStatusLabel = statusText(chatRowState(DEFAULT_CHAT_MODEL).status, false, true);
  const embedStatusLabel = statusText(rows.embed.status, false, true);
  const optionalStatusLabel = statusText(rows.mmproj.status, true, includeImages);

  const defaultCompatibility = assessCompatibility(DEFAULT_CHAT_MODEL, specs);
  const embedCompatibility = assessCompatibility(EMBED_MODEL, specs);
  const optionalCompatibility = assessCompatibility(selectedImageModel, specs);

  const chatTags = [{ label: defaultCompatibility, color: compatibilityTone(defaultCompatibility) }];
  const embedTags = [{ label: embedCompatibility, color: compatibilityTone(embedCompatibility) }];
  const optionalTags: TagSpec[] = [
    { label: "Vision", color: "purple" },
    { label: optionalCompatibility, color: compatibilityTone(optionalCompatibility) },
  ];

  return (
    <div className="min-h-screen" style={{ background: "#edf1ff" }}>
      <div className="relative flex min-h-screen flex-col overflow-hidden">
        <div
          style={{
            position: "absolute",
            top: -150,
            right: -150,
            width: 400,
            height: 400,
            borderRadius: "50%",
            background: "radial-gradient(circle,rgba(15,98,254,.07) 0%,transparent 70%)",
            pointerEvents: "none",
          }}
        />

        <div style={{ flex: 1, overflowY: "auto", padding: "40px 32px 24px", position: "relative", zIndex: 1 }}>
          <div style={{ maxWidth: 680, margin: "0 auto" }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
                padding: "5px 11px 5px 8px",
                borderRadius: 20,
                background: "rgba(15,98,254,.11)",
                marginBottom: 14,
              }}
            >
              <Cpu className="h-3.5 w-3.5" style={{ color: "#0F62FE" }} />
              <span style={{ fontSize: 10.5, fontWeight: 800, color: "#0F62FE", textTransform: "uppercase", letterSpacing: ".1em" }}>
                Setup · Local AI models
              </span>
            </div>
            <h1 style={{ fontSize: 30, fontWeight: 800, letterSpacing: "-0.6px", color: "#181e35", marginBottom: 8 }}>
              Download AI models
            </h1>
            <p style={{ fontSize: 14, color: "#6b7a9a", lineHeight: 1.6, marginBottom: 22, maxWidth: 560 }}>
              KLIN needs local AI models before setup can continue. Downloads are saved to your app data folder and reused on future launches. Your files never leave your machine.
            </p>

            <div
              style={{
                display: "flex",
                gap: 11,
                padding: "12px 14px",
                borderRadius: 13,
                background: "rgba(16,185,129,.06)",
                border: "1.5px solid rgba(16,185,129,.18)",
                marginBottom: 24,
              }}
            >
              <div style={{ width: 30, height: 30, borderRadius: 9, background: "rgba(16,185,129,.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Lock className="h-3.5 w-3.5" style={{ color: "#10b981" }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12.5, fontWeight: 800, color: "#10b981", marginBottom: 2 }}>100% on-device</div>
                <div style={{ fontSize: 11.5, color: "#6b7a9a", lineHeight: 1.5 }}>
                  All models run locally. KLIN never sends your files or notes to any server.
                </div>
              </div>
            </div>

            <div style={{ marginBottom: 18 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, paddingLeft: 4 }}>
                <div style={{ width: 26, height: 26, borderRadius: 7, background: "rgba(15,98,254,.11)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <MessageSquare className="h-3.5 w-3.5" style={{ color: "#0F62FE" }} />
                </div>
                <div style={{ fontSize: 11, fontWeight: 800, color: "#6b7a9a", textTransform: "uppercase", letterSpacing: ".1em" }}>Chat model</div>
                <div style={{ flex: 1, height: 1, background: "#e4eafc" }} />
              </div>
              <ModelCard
                name={DEFAULT_CHAT_MODEL.label}
                description={DEFAULT_CHAT_MODEL.description}
                filename={DEFAULT_CHAT_MODEL.filename}
                sizeLabel={formatBytes(DEFAULT_CHAT_MODEL.sizeBytes)}
                statusLabel={chatStatusLabel}
                statusTone={statusTone(chatStatusLabel)}
                tags={chatTags}
                recommended
                selected={selectedChatId === DEFAULT_CHAT_MODEL.id}
                disabled={isDownloading && selectedChatId !== DEFAULT_CHAT_MODEL.id}
                onSelect={() => setSelectedChatId(DEFAULT_CHAT_MODEL.id)}
                progress={chatRowState(DEFAULT_CHAT_MODEL).progress}
                showProgress
                showAdvancedToggle
                advancedOpen={advancedOpen}
                onToggleAdvanced={() => setAdvancedOpen((open) => !open)}
                advancedSection={
                  <div
                    style={{
                      marginTop: 12,
                      paddingTop: 14,
                      borderTop: "1px dashed #e4eafc",
                      display: "flex",
                      flexDirection: "column",
                      gap: 8,
                    }}
                    className="klin-fade-in"
                  >
                    <div style={{ fontSize: 10.5, fontWeight: 800, color: "#a8b4cc", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 4 }}>
                      Alternative chat models
                    </div>
                    {advancedModels.map((model) => {
                      const compatibility = assessCompatibility(model, specs);
                      const tags: TagSpec[] = [{ label: compatibility, color: compatibilityTone(compatibility) }];
                      const isDisabled = isDownloading && model.id !== selectedChatId;
                      return (
                        <div
                          key={model.id}
                          onClick={(event) => {
                            event.stopPropagation();
                            if (isDisabled) return;
                            setSelectedChatId(model.id);
                          }}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            padding: "10px 12px",
                            borderRadius: 11,
                            background: selectedChatId === model.id ? "rgba(15,98,254,.11)" : "#f4f7ff",
                            border: `1.5px solid ${selectedChatId === model.id ? "#0F62FE" : "#e4eafc"}`,
                            cursor: isDisabled ? "not-allowed" : "pointer",
                            transition: "all .15s",
                            opacity: isDisabled ? 0.6 : 1,
                          }}
                        >
                          <div
                            style={{
                              width: 18,
                              height: 18,
                              borderRadius: "50%",
                              border: `2px solid ${selectedChatId === model.id ? "#0F62FE" : "#a8b4cc"}`,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              flexShrink: 0,
                            }}
                          >
                            {selectedChatId === model.id && <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#0F62FE" }} />}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12.5, fontWeight: 700, color: "#181e35" }}>{model.label}</div>
                            <div style={{ fontSize: 11, color: "#a8b4cc", fontFamily: "'JetBrains Mono', monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {model.filename}
                            </div>
                          </div>
                          <div style={{ display: "flex", gap: 5, flexShrink: 0 }}>
                            {tags.map((tag) => (
                              <TagPill key={`${model.id}-${tag.label}`} label={tag.label} color={tag.color} size="xs" />
                            ))}
                          </div>
                          <div style={{ fontSize: 12, fontWeight: 800, color: "#6b7a9a", fontFamily: "'JetBrains Mono', monospace", flexShrink: 0 }}>
                            {formatBytes(model.sizeBytes)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                }
              />
            </div>

            <div style={{ marginBottom: 18 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, paddingLeft: 4 }}>
                <div style={{ width: 26, height: 26, borderRadius: 7, background: "rgba(16,185,129,.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Hash className="h-3.5 w-3.5" style={{ color: "#10b981" }} />
                </div>
                <div style={{ fontSize: 11, fontWeight: 800, color: "#6b7a9a", textTransform: "uppercase", letterSpacing: ".1em" }}>Embed model</div>
                <div style={{ flex: 1, height: 1, background: "#e4eafc" }} />
              </div>
              <ModelCard
                name={EMBED_MODEL.label}
                description={EMBED_MODEL.description}
                filename={EMBED_MODEL.filename}
                sizeLabel={formatBytes(EMBED_MODEL.sizeBytes)}
                statusLabel={embedStatusLabel}
                statusTone={statusTone(embedStatusLabel)}
                tags={embedTags}
                locked
                icon={<Hash className="h-4 w-4" style={{ color: "#10b981" }} />}
                progress={rows.embed.progress}
                showProgress
              />
            </div>

            <div style={{ marginBottom: 24 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, paddingLeft: 4 }}>
                <div style={{ width: 26, height: 26, borderRadius: 7, background: "rgba(245,158,11,.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Image className="h-3.5 w-3.5" style={{ color: "#d97706" }} />
                </div>
                <div style={{ fontSize: 11, fontWeight: 800, color: "#6b7a9a", textTransform: "uppercase", letterSpacing: ".1em" }}>Optional model</div>
                <div style={{ flex: 1, height: 1, background: "#e4eafc" }} />
              </div>
              <ModelCard
                name={selectedImageModel.label}
                description={selectedImageModel.description}
                filename={selectedImageModel.filename}
                sizeLabel={formatBytes(selectedImageModel.sizeBytes)}
                statusLabel={optionalStatusLabel}
                statusTone={statusTone(optionalStatusLabel)}
                tags={optionalTags}
                optional
                selected={includeImages}
                disabled={rows.mmproj.status === "downloading"}
                onSelect={() => setIncludeImages((value) => !value)}
                progress={rows.mmproj.progress}
                showProgress={includeImages}
              />
            </div>

            {error && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#ef4444", fontSize: 12 }}>
                <AlertCircle className="h-3.5 w-3.5" />
                {error}
              </div>
            )}
          </div>
        </div>

        <div
          style={{
            padding: "14px 32px 18px",
            borderTop: "1px solid #e4eafc",
            background: "rgba(255,255,255,.7)",
            backdropFilter: "blur(12px)",
            display: "flex",
            alignItems: "center",
            gap: 14,
            flexShrink: 0,
            position: "relative",
            zIndex: 1,
          }}
        >
          <div style={{ maxWidth: 680, margin: "0 auto", width: "100%", display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ display: "flex", flexDirection: "column", whiteSpace: "nowrap" }}>
              <div style={{ fontSize: 10.5, fontWeight: 800, color: "#a8b4cc", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 2 }}>Total</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#181e35", fontFamily: "'JetBrains Mono', monospace", letterSpacing: "-0.3px" }}>
                {totalLabel}
              </div>
            </div>
            <div style={{ height: 32, width: 1, background: "#e4eafc" }} />
            <div style={{ display: "flex", flexDirection: "column", whiteSpace: "nowrap" }}>
              <div style={{ fontSize: 10.5, fontWeight: 800, color: "#a8b4cc", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 2 }}>Models</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#6b7a9a", whiteSpace: "nowrap" }}>{selectedCount} selected</div>
            </div>
            <div style={{ flex: 1 }} />
            <Button
              onClick={handleDownload}
              disabled={isDownloading}
              size="lg"
              className={isDownloading ? "px-5" : "px-5"}
            >
              {isDownloading ? (
                "Downloading..."
              ) : (
                <span className="inline-flex items-center gap-2">
                  <Download className="h-4 w-4" />
                  Download & Continue
                </span>
              )}
            </Button>
          </div>
        </div>
        <CloseAppController mode="quit-immediately" />
      </div>
    </div>
  );
}
