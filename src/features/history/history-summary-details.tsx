import { Button } from "@/components/ui/button";
import type { HistoryEntry } from "@/features/history/history-types";

interface HistorySummaryDetailsProps {
  entry: Extract<HistoryEntry, { type: "summary" }>;
  onOpenSummary: (path: string) => void;
}

export function HistorySummaryDetails({ entry, onOpenSummary }: HistorySummaryDetailsProps) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border/60 bg-muted/20 p-3 text-sm">
        <p className="text-xs text-muted-foreground">Source Files</p>
        <ul className="mt-2 space-y-1">
          {entry.fileNames.map((fileName) => (
            <li key={fileName} className="truncate">• {fileName}</li>
          ))}
        </ul>
      </div>
      {entry.categoryName && (
        <div className="rounded-xl border border-border/60 bg-muted/20 p-3 text-sm">
          <p className="text-xs text-muted-foreground">Category</p>
          <p className="mt-1 truncate">{entry.categoryName}</p>
        </div>
      )}
      <div className="rounded-xl border border-border/60 bg-muted/20 p-3 text-sm">
        <p className="text-xs text-muted-foreground">Created</p>
        <p className="mt-1 truncate">{new Date(entry.timestamp).toLocaleString()}</p>
      </div>
      <div className="flex items-center justify-end rounded-xl border border-border/60 bg-background p-3">
        <Button size="sm" onClick={() => onOpenSummary(entry.summaryPath)}>
          Open Note File
        </Button>
      </div>
    </div>
  );
}
