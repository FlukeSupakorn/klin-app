import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { OrganizePreviewItem } from "@/types/domain";
import type { OrganizeWorkflow } from "./use-organize-workflow";

interface OrganizeFilesModalProps {
  workflow: OrganizeWorkflow;
}

function FileCard({ item, workflow }: { item: OrganizePreviewItem; workflow: OrganizeWorkflow }) {
  return (
    <div className="rounded-xl border border-border p-4">
      <div className="mb-2 flex items-center justify-between">
        <div>
          <p className="font-semibold">{item.fileName}</p>
          <p className="text-xs text-muted-foreground">{item.currentPath}</p>
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

              void workflow.moveSingleItem(item);
            }}
            disabled={item.analysisStatus !== "completed" || item.moveStatus === "processing"}
          >
            {item.analysisStatus !== "completed"
              ? "Waiting..."
              : item.moveStatus === "processing"
                ? "Moving..."
                : item.moveStatus === "completed"
                  ? "Undo"
                  : item.moveStatus === "failed"
                    ? "Retry Move"
                    : "Move"}
          </Button>
        </div>
      </div>

      {item.analysisStatus === "completed" ? (
        <>
          <div className="mb-3 flex flex-wrap gap-2">
            {item.topScores.map((score) => (
              <button
                type="button"
                key={score.name}
                onClick={() => workflow.applyCategory(item.id, score.name)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs transition-colors",
                  item.selectedCategory === score.name
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-foreground",
                )}
              >
                {score.name} · {Math.round(score.score * 100)}%
              </button>
            ))}
          </div>

          <div className="space-y-2 rounded-lg bg-muted/40 p-3 text-xs">
            <p><strong>Move to:</strong> {item.destinationPath}</p>
            <p><strong>Confidence:</strong> {Math.round(item.confidence * 100)}%</p>
            <p><strong>Summary:</strong> {item.summary ?? "No summary"}</p>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                className="h-7 gap-1"
                onClick={() => workflow.toggleSuggestionFor(item.id)}
              >
                Suggest Name
              </Button>
              <span>
                {item.suggestedName ? (
                  <>Suggested name: <strong>{item.suggestedName}</strong></>
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
                      <Button
                        key={name}
                        size="sm"
                        variant={item.suggestedName === name ? "default" : "outline"}
                        className="h-7"
                        onClick={() => workflow.applySuggestedName(item.id, name)}
                      >
                        {name}
                      </Button>
                    ))}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7"
                      onClick={() => workflow.applySuggestedName(item.id, null)}
                    >
                      Use Original
                    </Button>
                  </>
                ) : (
                  <span className="text-muted-foreground">No recommendation</span>
                )}
              </div>
            )}
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
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {workflow.errorMessage}
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
