import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { HistoryEntry } from "@/features/history/history-types";

interface HistoryOrganizeDetailsProps {
  entry: Extract<HistoryEntry, { type: "organize" }>;
  isShowAllScores: boolean;
  selectedScoreCategory?: string;
  onToggleScores: () => void;
  onRequestEditMovedTo: (entryId: string) => void;
  onUseScoreFolder: (entryId: string, categoryName: string) => void;
}

export function HistoryOrganizeDetails({
  entry,
  isShowAllScores,
  selectedScoreCategory,
  onToggleScores,
  onRequestEditMovedTo,
  onUseScoreFolder,
}: HistoryOrganizeDetailsProps) {
  const visibleScores = isShowAllScores ? entry.scores : entry.scores.slice(0, 3);
  const isRenamed = entry.oldName !== entry.newName;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-border/60 bg-muted/20 p-3 text-sm">
          <p className="mb-1 text-xs text-muted-foreground">From</p>
          <p className="truncate font-medium" title={entry.fromPath}>{entry.fromPath}</p>
        </div>
        <div className="rounded-xl border border-border/60 bg-muted/20 p-3 text-sm">
          <div className="mb-1 flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Moved To</p>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={() => onRequestEditMovedTo(entry.id)}
            >
              <Pencil className="mr-1 h-3.5 w-3.5" />
              Edit
            </Button>
          </div>
          <p className="truncate font-medium" title={entry.toPath}>{entry.toPath}</p>
        </div>
      </div>

      <div className="rounded-xl border border-border/60 bg-muted/20 p-3 text-sm">
        <p className="mb-1 text-xs text-muted-foreground">Rename</p>
        <p className="font-medium">
          {isRenamed ? (
            <>
              <span className="font-normal text-foreground/70">{entry.oldName}</span>
              <span className="px-1.5 text-foreground/50">→</span>
              <span className="font-semibold text-foreground">{entry.newName}</span>
            </>
          ) : (
            "No rename"
          )}
        </p>
      </div>

      <div className="rounded-xl border border-border/60 bg-background p-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-medium">Category Scores</p>
          {entry.scores.length > 3 && (
            <Button variant="ghost" size="sm" onClick={onToggleScores}>
              {isShowAllScores ? "Show less" : "View more"}
            </Button>
          )}
        </div>

        <p className="mb-3 text-xs text-muted-foreground">Select a score to change destination folder.</p>

        <div className="space-y-3">
          {visibleScores.map((score) => (
            <button
              key={score.name}
              type="button"
              onClick={() => onUseScoreFolder(entry.id, score.name)}
              className={cn(
                "w-full space-y-1 rounded-lg border border-transparent p-2 text-left transition-colors hover:border-border hover:bg-muted/30",
                selectedScoreCategory === score.name && "border-primary/40 bg-primary/5",
              )}
            >
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium">{score.name}</span>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">{Math.round(score.score * 100)}%</span>
                  <span className="text-[11px] text-muted-foreground">
                    {selectedScoreCategory === score.name ? "Selected" : "Use folder"}
                  </span>
                </div>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary" style={{ width: `${score.score * 100}%` }} />
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
