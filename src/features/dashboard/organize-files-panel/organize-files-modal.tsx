import { useEffect, useState } from "react";
import { AlertTriangle, Pencil, Sparkles } from "lucide-react";
import { Button } from "@/components/not-use-ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/not-use-ui/card";
import { Input } from "@/components/not-use-ui/input";
import { cn } from "@/lib/utils";
import { useCategoryManagementStore } from "@/stores/use-category-management-store";
import type { OrganizePreviewItem } from "@/types/domain";
import type { OrganizeWorkflow } from "./use-organize-workflow";

interface OrganizeFilesModalProps {
  workflow: OrganizeWorkflow;
}

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

function normalizeCategoryName(value: string): string {
  return value.trim().toLowerCase();
}

function findCategoryColor(name: string, palette: Array<{ name: string; color: string }>): string | null {
  const normalized = normalizeCategoryName(name);
  if (!normalized) {
    return null;
  }

  const matched = palette.find((item) => normalizeCategoryName(item.name) === normalized);
  return matched?.color ?? null;
}

function splitDestinationPath(destinationPath: string): { folderPath: string; fileName: string } {
  const slashIndex = Math.max(destinationPath.lastIndexOf("/"), destinationPath.lastIndexOf("\\"));
  if (slashIndex < 0) {
    return { folderPath: "", fileName: destinationPath };
  }

  return {
    folderPath: destinationPath.slice(0, slashIndex),
    fileName: destinationPath.slice(slashIndex + 1),
  };
}

function FileCard({ item, workflow }: { item: OrganizePreviewItem; workflow: OrganizeWorkflow }) {
  const categories = useCategoryManagementStore((state) => state.categories);
  const { folderPath, fileName } = splitDestinationPath(item.destinationPath);
  const currentSplit = splitDestinationPath(item.currentPath);
  const normalizePath = (value: string) => value.replace(/\\/g, "/").replace(/\/+$/g, "").toLowerCase();
  const isNoChange = normalizePath(item.currentPath) === normalizePath(item.destinationPath);
  const isFolderChanged = normalizePath(currentSplit.folderPath) !== normalizePath(folderPath);
  const isNameChanged = currentSplit.fileName.trim().toLowerCase() !== fileName.trim().toLowerCase();
  const isRenameOnly = isNameChanged && !isFolderChanged;
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(fileName);

  useEffect(() => {
    setNameDraft(fileName);
  }, [fileName, item.id]);

  const saveFileName = () => {
    const trimmed = nameDraft.trim();
    if (!trimmed) {
      setNameDraft(fileName);
      setIsEditingName(false);
      return;
    }
    workflow.updateFileName(item.id, trimmed);
    setIsEditingName(false);
  };

  const itemWithDraftName = (): OrganizePreviewItem => {
    const trimmed = nameDraft.trim();
    if (!isEditingName || !trimmed || trimmed === fileName) {
      return item;
    }

    const separator = folderPath.includes("\\") ? "\\" : "/";
    const nextDestinationPath = folderPath ? `${folderPath}${separator}${trimmed}` : trimmed;

    return {
      ...item,
      destinationPath: nextDestinationPath,
    };
  };

  return (
    <div className="rounded-xl border border-border p-4">
      <div className="mb-2 flex items-center justify-between">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">Name:</span>
            {isEditingName ? (
              <>
                <Input
                  value={nameDraft}
                  onChange={(event) => setNameDraft(event.target.value)}
                  onBlur={saveFileName}
                  className="h-8 max-w-md text-sm"
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      saveFileName();
                    }

                    if (event.key === "Escape") {
                      setNameDraft(fileName);
                      setIsEditingName(false);
                    }
                  }}
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 w-6 p-0"
                  onClick={saveFileName}
                  aria-label="Save name"
                  title="Save name"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              </>
            ) : (
              <>
                <p className="truncate text-sm font-semibold">{fileName}</p>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                  onClick={() => setIsEditingName(true)}
                  aria-label="Edit name"
                  title="Edit name"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">Folder:</span>
            <p className="truncate text-xs text-muted-foreground">{folderPath || "(same folder)"}</p>
          </div>
          <p className="text-[11px] text-muted-foreground">Original: {item.currentPath}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            <span
              className={cn(
                "rounded-full px-2 py-1 font-semibold",
                item.analysisStatus === "completed" && "bg-emerald-500/10 text-emerald-700",
                item.analysisStatus === "processing" && "bg-amber-500/10 text-amber-700",
                item.analysisStatus === "queued" && "bg-muted text-muted-foreground",
                item.analysisStatus === "failed" && "bg-destructive/10 text-destructive",
              )}
            >
              {item.analysisStatus === "completed"
                ? "Ready"
                : item.analysisStatus === "processing"
                  ? "Organizing"
                  : item.analysisStatus === "queued"
                    ? "Queued"
                    : "Analysis Failed"}
            </span>

            {item.moveStatus === "processing" && (
              <span className="rounded-full bg-amber-500/10 px-2 py-1 font-semibold text-amber-700">Moving</span>
            )}
            {item.moveStatus === "completed" && (
              <span className="rounded-full bg-emerald-500/10 px-2 py-1 font-semibold text-emerald-700">Moved</span>
            )}
            {item.moveStatus === "failed" && (
              <span className="rounded-full bg-destructive/10 px-2 py-1 font-semibold text-destructive">Move Failed</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {(item.analysisStatus === "queued" || item.analysisStatus === "processing") && (
            <Button size="sm" variant="outline" onClick={() => workflow.cancelItem(item.id)}>
              Cancel
            </Button>
          )}
          {item.analysisStatus === "failed" && (
            <Button size="sm" variant="outline" onClick={() => workflow.retryAnalyzeItem(item.id)}>
              Retry Analysis
            </Button>
          )}
          <Button
            size="sm"
            variant={item.moveStatus === "completed" ? "outline" : "default"}
            onClick={() => {
              if (item.moveStatus === "completed") {
                void workflow.undoSingleItem(item);
                return;
              }

              const itemForMove = itemWithDraftName();
              if (itemForMove.destinationPath !== item.destinationPath) {
                workflow.updateFileName(item.id, nameDraft.trim());
                setIsEditingName(false);
              }

              void workflow.moveSingleItem(itemForMove);
            }}
            disabled={item.analysisStatus !== "completed" || item.moveStatus === "processing" || (item.moveStatus !== "completed" && isNoChange)}
          >
            {item.analysisStatus !== "completed"
              ? "Waiting..."
              : item.moveStatus === "processing"
                ? "Moving..."
                : item.moveStatus === "completed"
                  ? "Undo"
                  : isNoChange
                    ? "No Change"
                    : item.moveStatus === "failed"
                      ? (isRenameOnly ? "Retry Rename" : "Retry Move")
                      : (isRenameOnly ? "Rename" : "Move")}
          </Button>
        </div>
      </div>

      {item.analysisStatus === "completed" ? (
        <>
          <div className="mb-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => workflow.setNoMoveCategory(item.id)}
              className={cn(
                "rounded-full px-3 py-1 text-xs transition-colors",
                item.selectedCategory === "No category"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-foreground",
              )}
            >
              None
            </button>
            {item.topScores.map((score) => (
              (() => {
                const isSelected = item.selectedCategory === score.name;
                const categoryColor = findCategoryColor(score.name, categories);
                return (
                  <button
                    type="button"
                    key={score.name}
                    onClick={() => workflow.applyCategory(item.id, score.name)}
                    className={cn(
                      "relative rounded-full border px-3 py-1 pl-5 text-xs transition-colors",
                      isSelected
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground hover:bg-muted/80",
                    )}
                  >
                    <span
                      className="absolute left-2 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full"
                      style={{ backgroundColor: categoryColor ?? "currentColor" }}
                    />
                    {score.name} · {Math.round(score.score * 100)}%
                  </button>
                );
              })()
            ))}
          </div>

          <div className="space-y-2 rounded-lg bg-muted/40 p-3 text-xs">
            <p><strong>Move to:</strong> {item.destinationPath}</p>
            <p><strong>Confidence:</strong> {Math.round(item.confidence * 100)}%</p>
            <p><strong>Category:</strong> {item.selectedCategory}</p>
            {isNoChange && (
              <p className="font-semibold text-amber-700">Can't move yet: no change detected.</p>
            )}
            <p><strong>Summary:</strong> {item.summary ?? "No summary"}</p>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => workflow.toggleSuggestionFor(item.id)}
                  className={cn(
                    "h-6 w-6 p-0 text-muted-foreground hover:text-foreground",
                    workflow.openSuggestionFor === item.id && "text-primary",
                  )}
                  aria-label="Edit suggested name"
                  title="Edit suggested name"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <span className="text-xs text-muted-foreground">
                  {item.suggestedName ? (
                    <>Selected: <strong className="text-foreground">{item.suggestedName}</strong></>
                  ) : (
                    <>No recommendation</>
                  )}
                </span>
              </div>

              {workflow.openSuggestionFor === item.id && (
                <div className="flex flex-wrap gap-2">
                  {item.suggestedNames.length > 0 ? (
                    <>
                      {item.suggestedNames.map((name) => (
                        <button
                          type="button"
                          key={name}
                          onClick={() => workflow.applySuggestedName(item.id, name)}
                          className={cn(
                            "rounded-full px-3 py-1 text-xs transition-colors",
                            item.suggestedName === name
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-foreground",
                          )}
                        >
                          {name}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => workflow.applySuggestedName(item.id, null)}
                        className={cn(
                          "rounded-full px-3 py-1 text-xs transition-colors",
                          item.suggestedName === null
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-foreground",
                        )}
                      >
                        Use Original
                      </button>
                    </>
                  ) : (
                    <span className="text-xs text-muted-foreground">No recommendation</span>
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        <div className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
          {item.analysisStatus === "failed"
            ? `Analysis failed: ${item.analysisError ?? "Unknown error"}`
            : "Waiting for analysis..."}
        </div>
      )}
    </div>
  );
}

export function OrganizeFilesModal({ workflow }: OrganizeFilesModalProps) {
  if (!workflow.modalOpen) {
    return null;
  }

  const isLockWarning = Boolean(workflow.errorMessage?.startsWith("Skipped "));
  const [showWarningDetails, setShowWarningDetails] = useState(false);
  const parsedWarning = workflow.errorMessage ? splitLockNotice(workflow.errorMessage) : null;

  useEffect(() => {
    setShowWarningDetails(false);
  }, [workflow.errorMessage]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <Card className="h-[80vh] w-full max-w-5xl overflow-hidden border border-border bg-card">
        <CardHeader>
          <CardTitle>Files to organize</CardTitle>
          <CardDescription>
            {workflow.items.length} file(s) - {workflow.readyCount} ready, {workflow.processingCount} analyzing, {workflow.queuedCount} queued, {workflow.failedCount} failed, {workflow.movedCount} moved
          </CardDescription>
        </CardHeader>
        <CardContent className="flex h-[calc(80vh-96px)] flex-col gap-4 overflow-hidden">
          <Input placeholder="Search files..." />

          {workflow.errorMessage && (
            <div
              className={cn(
                "rounded-lg border px-3 py-2 text-sm",
                isLockWarning
                  ? "border-amber-500/40 bg-amber-500/10 text-amber-700"
                  : "border-destructive/40 bg-destructive/10 text-destructive",
              )}
            >
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <div className="space-y-2">
                  <p className="leading-5">
                    {parsedWarning?.summary ?? workflow.errorMessage}
                    {isLockWarning && (parsedWarning?.details.length ?? 0) > 0 && (
                      <>
                        {" "}
                        <button
                          type="button"
                          onClick={() => setShowWarningDetails((prev) => !prev)}
                          className="text-xs font-semibold underline underline-offset-2"
                        >
                          {showWarningDetails ? "Hide details" : "Read more"}
                        </button>
                      </>
                    )}
                  </p>
                  {isLockWarning && (parsedWarning?.details.length ?? 0) > 0 && (
                    <div className="space-y-2">
                      {showWarningDetails && (
                        <ul className="list-disc space-y-1 pl-4 text-xs">
                          {parsedWarning?.details.map((detail) => (
                            <li key={detail}>{detail}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {workflow.isAnalyzing && (
            <div className="rounded-lg border border-border/60 bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
              Running analysis queue...
            </div>
          )}

          <div className="flex-1 space-y-4 overflow-y-auto pr-1">
            {workflow.items.map((item) => (
              <FileCard key={item.id} item={item} workflow={workflow} />
            ))}
          </div>

          <div className="flex items-center justify-between border-t border-border pt-3">
            <div className="flex gap-2">
              <Button
                className="gap-2"
                onClick={() => (workflow.canUndoAll ? void workflow.undoAllMoved() : void workflow.moveAllPending())}
                disabled={workflow.canUndoAll ? workflow.movedCount === 0 : workflow.readyToMoveCount === 0}
              >
                <Sparkles className="h-4 w-4" />
                {workflow.canUndoAll
                  ? `Undo All Files (${workflow.movedCount})`
                  : workflow.allReadyMoved
                    ? "All Ready Files Moved"
                    : `Move Ready Files (${workflow.readyToMoveCount})`}
              </Button>
              <Button variant="outline" onClick={workflow.cancelOrganize}>
                Cancel Organize
              </Button>
              <Button variant="outline" onClick={() => void workflow.handleAddFiles()}>Add More Files</Button>
              <Button variant="outline" onClick={() => workflow.setOpenSettingsWindow(true)}>Manage Categories</Button>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={workflow.clearCompleted}>Clear Organized</Button>
              <Button variant="outline" onClick={workflow.closeModal}>Close</Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
