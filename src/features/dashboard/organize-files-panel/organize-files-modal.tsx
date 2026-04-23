import { useEffect, useState } from "react";
import { AlertTriangle, FileText, Pencil, Search, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { splitDestinationPath } from "@/lib/path-utils";
import { findCategoryColor } from "@/lib/category-utils";
import { useCategoryManagementStore } from "@/stores/use-category-management-store";
import type { OrganizePreviewItem } from "@/types/domain";
import type { OrganizeWorkflow } from "@/hooks/organize/use-organize-workflow";

const LOCK_NOTICE_DETAILS_SEPARATOR = "\n__DETAILS__\n";

function splitLockNotice(message: string): { summary: string; details: string[] } {
  const [summaryPart, detailsPart] = message.split(LOCK_NOTICE_DETAILS_SEPARATOR);
  const summary = (summaryPart ?? "").trim();
  const details = (detailsPart ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  return { summary, details };
}

function confColor(c: number): string {
  return c >= 80 ? "var(--success)" : c >= 65 ? "var(--warning)" : "var(--destructive)";
}

function getStatusInfo(item: OrganizePreviewItem): { label: string; bg: string; color: string } {
  if (item.moveStatus === "completed") return { label: "Moved", bg: "var(--success-tint)", color: "var(--success)" };
  if (item.moveStatus === "processing") return { label: "Moving", bg: "var(--warning-tint)", color: "var(--warning)" };
  if (item.moveStatus === "failed") return { label: "Move Failed", bg: "var(--destructive-tint)", color: "var(--destructive)" };
  if (item.analysisStatus === "completed") return { label: "Ready", bg: "var(--success-tint)", color: "var(--success)" };
  if (item.analysisStatus === "processing") return { label: "Analyzing", bg: "var(--warning-tint)", color: "var(--warning)" };
  if (item.analysisStatus === "queued") return { label: "Queued", bg: "var(--muted)", color: "var(--muted-foreground)" };
  return { label: "Failed", bg: "var(--destructive-tint)", color: "var(--destructive)" };
}

interface OrganizeFilesModalProps {
  workflow: OrganizeWorkflow;
}

function FileListItem({
  item,
  isSelected,
  onClick,
}: {
  item: OrganizePreviewItem;
  isSelected: boolean;
  onClick: () => void;
}) {
  const { fileName } = splitDestinationPath(item.destinationPath);
  const isMoved = item.moveStatus === "completed";
  const status = getStatusInfo(item);
  const conf = Math.round(item.confidence * 100);

  return (
    <button
      type="button"
      onClick={!isMoved ? onClick : undefined}
      className="w-full border-b border-border px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-muted/40"
      style={{
        background: isSelected && !isMoved ? "var(--primary-tint)" : "transparent",
        opacity: isMoved ? 0.5 : 1,
        cursor: isMoved ? "default" : "pointer",
      }}
    >
      <div className="flex items-center gap-2.5">
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px]"
          style={{ background: "var(--primary)" }}
        >
          <FileText className="h-3.5 w-3.5 text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[12px] font-bold text-foreground">{fileName}</div>
          <div className="mt-1 flex items-center gap-1.5">
            <span
              className="rounded-full px-1.5 py-0.5 text-[9.5px] font-bold"
              style={{ background: status.bg, color: status.color }}
            >
              {status.label}
            </span>
            {conf > 0 && (
              <span className="text-[10.5px] font-extrabold" style={{ color: confColor(conf) }}>
                {conf}%
              </span>
            )}
          </div>
        </div>
        {isSelected && !isMoved && (
          <div className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: "var(--primary)" }} />
        )}
      </div>
    </button>
  );
}

function FileDetailPanel({
  item,
  workflow,
}: {
  item: OrganizePreviewItem;
  workflow: OrganizeWorkflow;
}) {
  const categories = useCategoryManagementStore((state) => state.categories);
  const { folderPath, fileName } = splitDestinationPath(item.destinationPath);
  const currentSplit = splitDestinationPath(item.currentPath);
  const normalizePath = (v: string) => v.replace(/\\/g, "/").replace(/\/+$/g, "").toLowerCase();
  const isNoChange = normalizePath(item.currentPath) === normalizePath(item.destinationPath);
  const isFolderChanged = normalizePath(currentSplit.folderPath) !== normalizePath(folderPath);
  const isNameChanged = currentSplit.fileName.trim().toLowerCase() !== fileName.trim().toLowerCase();
  const isRenameOnly = isNameChanged && !isFolderChanged;
  const isMoved = item.moveStatus === "completed";

  const [isEditingName, setIsEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(fileName);

  useEffect(() => { setNameDraft(fileName); }, [fileName, item.id]);

  const saveFileName = () => {
    const trimmed = nameDraft.trim();
    if (!trimmed) { setNameDraft(fileName); setIsEditingName(false); return; }
    workflow.updateFileName(item.id, trimmed);
    setIsEditingName(false);
  };

  const itemWithDraftName = (): OrganizePreviewItem => {
    const trimmed = nameDraft.trim();
    if (!isEditingName || !trimmed || trimmed === fileName) return item;
    const sep = folderPath.includes("\\") ? "\\" : "/";
    return { ...item, destinationPath: folderPath ? `${folderPath}${sep}${trimmed}` : trimmed };
  };

  const status = getStatusInfo(item);
  const conf = Math.round(item.confidence * 100);

  const getMoveLabel = () => {
    if (item.analysisStatus !== "completed") return "Waiting...";
    if (item.moveStatus === "processing") return "Moving...";
    if (isMoved) return "Undo";
    if (isNoChange) return "No Change";
    if (item.moveStatus === "failed") return isRenameOnly ? "Retry Rename" : "Retry Move";
    return isRenameOnly ? "Rename" : "Move";
  };

  return (
    <div className="flex flex-col gap-4 p-5" style={{ animation: "klin-fade-in 0.2s ease" }}>
      {/* File header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex items-center gap-2">
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-bold"
              style={{ background: status.bg, color: status.color }}
            >
              {status.label}
            </span>
            {item.analysisStatus === "failed" && (
              <button
                type="button"
                onClick={() => workflow.retryAnalyzeItem(item.id)}
                className="rounded-[7px] border border-border px-2 py-0.5 text-[10px] font-bold text-muted-foreground transition-colors hover:bg-muted"
              >
                Retry
              </button>
            )}
            {(item.analysisStatus === "queued" || item.analysisStatus === "processing") && (
              <button
                type="button"
                onClick={() => workflow.cancelItem(item.id)}
                className="rounded-[7px] border border-border px-2 py-0.5 text-[10px] font-bold text-muted-foreground transition-colors hover:bg-muted"
              >
                Cancel
              </button>
            )}
          </div>

          {isEditingName ? (
            <div className="flex items-center gap-2">
              <input
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                onBlur={saveFileName}
                className="flex-1 rounded-[10px] border border-primary bg-background px-3 py-1.5 text-[13.5px] font-extrabold text-foreground focus:outline-none"
                style={{ boxShadow: "0 0 0 3px var(--primary-soft)" }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveFileName();
                  if (e.key === "Escape") { setNameDraft(fileName); setIsEditingName(false); }
                }}
                autoFocus
              />
              <button
                type="button"
                onClick={saveFileName}
                className="rounded-[9px] px-3 py-1.5 text-[12px] font-bold text-white"
                style={{ background: "var(--primary)" }}
              >
                Save
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <div
                className="text-[14px] font-extrabold text-foreground"
                style={{ wordBreak: "break-all", lineHeight: 1.45 }}
              >
                {fileName}
              </div>
              <button
                type="button"
                onClick={() => setIsEditingName(true)}
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[7px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <Pencil className="h-3 w-3" />
              </button>
            </div>
          )}

          <div
            className="mt-1 truncate text-[11px] text-muted-foreground"
            style={{ fontFamily: "'JetBrains Mono',monospace" }}
          >
            {item.currentPath}
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            if (isMoved) { void workflow.undoSingleItem(item); return; }
            const forMove = itemWithDraftName();
            if (forMove.destinationPath !== item.destinationPath) {
              workflow.updateFileName(item.id, nameDraft.trim());
              setIsEditingName(false);
            }
            void workflow.moveSingleItem(forMove);
          }}
          disabled={item.analysisStatus !== "completed" || item.moveStatus === "processing" || (!isMoved && isNoChange)}
          className="shrink-0 rounded-[10px] px-4 py-2 text-[12.5px] font-bold transition-all disabled:opacity-50"
          style={{
            background: isMoved ? "var(--muted)" : "var(--primary)",
            color: isMoved ? "var(--foreground)" : "var(--primary-foreground)",
            border: isMoved ? "1px solid var(--border)" : "none",
          }}
        >
          {getMoveLabel()}
        </button>
      </div>

      {/* Category suggestions */}
      {item.analysisStatus === "completed" && (
        <>
          <div>
            <div className="mb-2 text-[10.5px] font-extrabold uppercase tracking-widest text-muted-foreground">
              AI Category Suggestions
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => workflow.setNoMoveCategory(item.id)}
                className="rounded-full px-3 py-1 text-[11.5px] font-semibold transition-colors"
                style={{
                  background: item.selectedCategory === "No category" ? "var(--primary)" : "var(--muted)",
                  color: item.selectedCategory === "No category" ? "var(--primary-foreground)" : "var(--muted-foreground)",
                }}
              >
                None
              </button>
              {item.topScores.map((score) => {
                const isSelected = item.selectedCategory === score.name;
                const categoryColor = findCategoryColor(score.name, categories);
                return (
                  <button
                    type="button"
                    key={score.name}
                    onClick={() => workflow.applyCategory(item.id, score.name)}
                    className="relative rounded-full px-3 py-1 pl-5 text-[11.5px] font-semibold transition-colors"
                    style={{
                      background: isSelected ? "var(--primary)" : "var(--muted)",
                      color: isSelected ? "var(--primary-foreground)" : "var(--foreground)",
                      border: `1.5px solid ${isSelected ? "transparent" : "var(--border)"}`,
                    }}
                  >
                    <span
                      className="absolute left-2 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full"
                      style={{
                        background: isSelected
                          ? "rgba(255,255,255,0.7)"
                          : (categoryColor ?? confColor(Math.round(score.score * 100))),
                      }}
                    />
                    {score.name} · {Math.round(score.score * 100)}%
                  </button>
                );
              })}
            </div>
          </div>

          {/* Detail card */}
          <div
            className="rounded-[14px] border p-4"
            style={{ background: "var(--muted)", borderColor: "var(--border)" }}
          >
            <div className="space-y-3">
              <div>
                <div className="mb-1 text-[10.5px] font-extrabold uppercase tracking-widest text-muted-foreground">Move To</div>
                <div
                  className="break-all text-[12px] font-medium text-primary"
                  style={{ fontFamily: "'JetBrains Mono',monospace" }}
                >
                  {item.destinationPath}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="mb-1 text-[10.5px] font-extrabold uppercase tracking-widest text-muted-foreground">Confidence</div>
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full" style={{ background: "var(--border)" }}>
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${conf}%`, background: confColor(conf) }}
                      />
                    </div>
                    <span className="text-[13px] font-extrabold" style={{ color: confColor(conf) }}>{conf}%</span>
                  </div>
                </div>
                <div>
                  <div className="mb-1 text-[10.5px] font-extrabold uppercase tracking-widest text-muted-foreground">Category</div>
                  <div className="text-[13px] font-bold text-foreground">{item.selectedCategory}</div>
                </div>
              </div>
              {isNoChange && !isMoved && (
                <div className="text-[11.5px] font-semibold" style={{ color: "var(--warning)" }}>
                  Can't move yet: no change detected.
                </div>
              )}
              {item.summary && (
                <div>
                  <div className="mb-1 text-[10.5px] font-extrabold uppercase tracking-widest text-muted-foreground">AI Summary</div>
                  <div className="text-[12.5px] leading-relaxed text-muted-foreground">{item.summary}</div>
                </div>
              )}
            </div>
          </div>

          {/* Name suggestions */}
          <div>
            <button
              type="button"
              onClick={() => workflow.toggleSuggestionFor(item.id)}
              className={cn(
                "flex items-center gap-1.5 rounded-[9px] border border-border px-2.5 py-1 text-[11px] font-bold transition-colors",
                workflow.openSuggestionFor === item.id
                  ? "border-primary/30 text-primary"
                  : "text-muted-foreground hover:bg-muted",
              )}
              style={workflow.openSuggestionFor === item.id ? { background: "var(--primary-tint)" } : {}}
            >
              <Pencil className="h-3 w-3" />
              {item.suggestedName ? `Rename: ${item.suggestedName}` : "Name suggestions"}
            </button>
            {workflow.openSuggestionFor === item.id && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {item.suggestedNames.length > 0 ? (
                  <>
                    {item.suggestedNames.map((name) => (
                      <button
                        type="button"
                        key={name}
                        onClick={() => workflow.applySuggestedName(item.id, name)}
                        className="rounded-full px-3 py-1 text-[11.5px] font-semibold transition-colors"
                        style={{
                          background: item.suggestedName === name ? "var(--primary)" : "var(--muted)",
                          color: item.suggestedName === name ? "var(--primary-foreground)" : "var(--foreground)",
                        }}
                      >
                        {name}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => workflow.applySuggestedName(item.id, null)}
                      className="rounded-full px-3 py-1 text-[11.5px] font-semibold transition-colors"
                      style={{
                        background: item.suggestedName === null ? "var(--primary)" : "var(--muted)",
                        color: item.suggestedName === null ? "var(--primary-foreground)" : "var(--foreground)",
                      }}
                    >
                      Use Original
                    </button>
                  </>
                ) : (
                  <span className="text-[11px] text-muted-foreground">No name suggestions</span>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {item.analysisStatus !== "completed" && item.analysisStatus !== "failed" && (
        <div
          className="rounded-[12px] border border-border p-4 text-[12.5px] text-muted-foreground"
          style={{ background: "var(--muted)" }}
        >
          {item.analysisStatus === "queued" ? "Waiting for analysis..." : "Analyzing file..."}
        </div>
      )}

      {item.analysisStatus === "failed" && (
        <div
          className="rounded-[12px] border p-4 text-[12.5px]"
          style={{
            background: "var(--destructive-tint)",
            borderColor: "var(--destructive-border)",
            color: "var(--destructive)",
          }}
        >
          Analysis failed: {item.analysisError ?? "Unknown error"}
        </div>
      )}
    </div>
  );
}

export function OrganizeFilesModal({ workflow }: OrganizeFilesModalProps) {
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [showWarningDetails, setShowWarningDetails] = useState(false);
  const isLockWarning = Boolean(workflow.errorMessage?.startsWith("Skipped "));
  const parsedWarning = workflow.errorMessage ? splitLockNotice(workflow.errorMessage) : null;

  useEffect(() => { setShowWarningDetails(false); }, [workflow.errorMessage]);

  useEffect(() => {
    if (!selectedItemId && workflow.items.length > 0) {
      const firstActive = workflow.items.find((i) => i.moveStatus !== "completed");
      setSelectedItemId(firstActive?.id ?? workflow.items[0]?.id ?? null);
    }
  }, [workflow.items, selectedItemId]);

  if (!workflow.modalOpen) return null;

  const filtered = workflow.items.filter((item) => {
    const { fileName } = splitDestinationPath(item.destinationPath);
    return fileName.toLowerCase().includes(q.toLowerCase());
  });

  const selectedItem = workflow.items.find((i) => i.id === selectedItemId) ?? null;
  const allMoved = workflow.items.length > 0 && workflow.items.every((i) => i.moveStatus === "completed");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div
        className="flex h-[88vh] w-full max-w-[860px] flex-col overflow-hidden rounded-[22px] border border-border bg-card"
        style={{ boxShadow: "0 30px 80px rgba(0,0,0,0.25)", animation: "klin-fade-in 0.25s ease" }}
      >
        {/* Header */}
        <div className="shrink-0 border-b border-border px-6 py-5">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-[17px] font-extrabold text-foreground" style={{ letterSpacing: "-0.3px" }}>
                Files to Organize
              </h2>
              <div className="mt-1.5 flex items-center gap-3 text-[12px]">
                {([
                  ["Total", workflow.items.length, "var(--muted-foreground)"],
                  ["Ready", workflow.readyCount, "var(--success)"],
                  ["Analyzing", workflow.processingCount + workflow.queuedCount, "var(--warning)"],
                  ["Moved", workflow.movedCount, "var(--primary)"],
                  ...(workflow.failedCount > 0 ? [["Failed", workflow.failedCount, "var(--destructive)"]] : []),
                ] as [string, number, string][]).map(([label, count, color]) => (
                  <span key={label}>
                    <span className="font-extrabold" style={{ color }}>{count}</span>{" "}
                    <span className="text-muted-foreground">{label}</span>
                  </span>
                ))}
              </div>
            </div>
            <button
              type="button"
              onClick={workflow.closeModal}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] border border-border bg-muted text-muted-foreground transition-colors hover:text-foreground"
            >
              <X className="h-[15px] w-[15px]" />
            </button>
          </div>

          {/* Search */}
          <div
            className="flex items-center gap-2 rounded-[11px] border border-border bg-background px-3"
            style={{ boxShadow: "var(--shadow-xs)" }}
          >
            <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search files..."
              className="h-9 flex-1 bg-transparent text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
          </div>

          {/* Error / warning */}
          {workflow.errorMessage && (
            <div
              className={cn("mt-3 rounded-[10px] border px-3 py-2 text-[12px]")}
              style={{
                background: isLockWarning ? "var(--warning-tint)" : "var(--destructive-tint)",
                borderColor: isLockWarning ? "var(--warning)" : "var(--destructive)",
                color: isLockWarning ? "var(--warning)" : "var(--destructive)",
                borderOpacity: "0.3",
              }}
            >
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <div>
                  <p>
                    {parsedWarning?.summary ?? workflow.errorMessage}
                    {isLockWarning && (parsedWarning?.details.length ?? 0) > 0 && (
                      <>{" "}<button type="button" onClick={() => setShowWarningDetails((p) => !p)} className="font-bold underline underline-offset-2">
                        {showWarningDetails ? "Hide" : "Read more"}
                      </button></>
                    )}
                  </p>
                  {isLockWarning && showWarningDetails && (
                    <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[11px]">
                      {parsedWarning?.details.map((d) => <li key={d}>{d}</li>)}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Body: two-panel */}
        <div className="flex min-h-0 flex-1 overflow-hidden">
          {/* Left: file list */}
          <div className="w-[280px] shrink-0 overflow-y-auto border-r border-border">
            {filtered.length === 0 ? (
              <div className="py-8 text-center text-[12px] text-muted-foreground">No files found.</div>
            ) : (
              filtered.map((item) => (
                <FileListItem
                  key={item.id}
                  item={item}
                  isSelected={selectedItemId === item.id}
                  onClick={() => setSelectedItemId(item.id)}
                />
              ))
            )}
          </div>

          {/* Right: detail */}
          <div className="flex-1 overflow-y-auto">
            {allMoved ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 opacity-60">
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-[14px]"
                  style={{ background: "var(--success-tint)", border: "1.5px solid var(--success)" }}
                >
                  <Sparkles className="h-5 w-5" style={{ color: "var(--success)" }} />
                </div>
                <div className="text-center">
                  <div className="text-[14px] font-extrabold text-foreground">All files processed</div>
                  <div className="mt-0.5 text-[12px] text-muted-foreground">Great work!</div>
                </div>
              </div>
            ) : selectedItem ? (
              <FileDetailPanel item={selectedItem} workflow={workflow} />
            ) : (
              <div className="flex h-full items-center justify-center text-[12px] text-muted-foreground">
                Select a file from the list
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div
          className="flex shrink-0 items-center gap-2 border-t border-border px-5 py-3.5"
          style={{ background: "var(--muted)" }}
        >
          <button
            type="button"
            onClick={() => (workflow.canUndoAll ? void workflow.undoAllMoved() : void workflow.moveAllPending())}
            disabled={workflow.canUndoAll ? workflow.movedCount === 0 : workflow.readyToMoveCount === 0}
            className="flex items-center gap-1.5 rounded-[10px] px-3.5 py-2 text-[12.5px] font-bold text-white disabled:opacity-50"
            style={{ background: "var(--primary)" }}
          >
            <Sparkles className="h-3.5 w-3.5" />
            {workflow.canUndoAll
              ? `Undo All (${workflow.movedCount})`
              : workflow.allReadyMoved
                ? "All Files Moved"
                : `Move Ready (${workflow.readyToMoveCount})`}
          </button>
          <button
            type="button"
            onClick={workflow.cancelOrganize}
            className="rounded-[10px] border border-border px-3.5 py-2 text-[12.5px] font-bold text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void workflow.handleAddFiles()}
            className="rounded-[10px] border border-border px-3.5 py-2 text-[12.5px] font-bold text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
          >
            Add More
          </button>
          <button
            type="button"
            onClick={() => workflow.setOpenSettingsWindow(true)}
            className="rounded-[10px] border border-border px-3.5 py-2 text-[12.5px] font-bold text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
          >
            Categories
          </button>
          <div className="flex-1" />
          <button
            type="button"
            onClick={workflow.clearCompleted}
            className="rounded-[10px] border border-border px-3.5 py-2 text-[12.5px] font-bold text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
          >
            Clear Moved
          </button>
          <button
            type="button"
            onClick={workflow.closeModal}
            className="rounded-[10px] border border-border px-3.5 py-2 text-[12.5px] font-bold text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
