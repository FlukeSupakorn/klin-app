import { Button } from "@/components/ui/button";
import type { HistoryEntry } from "@/features/history/history-mock-data";

interface HistorySummaryDetailsProps {
  entry: Extract<HistoryEntry, { type: "summary" }>;
  onOpenSummary: (path: string) => void;
}

export function HistorySummaryDetails({ entry, onOpenSummary }: HistorySummaryDetailsProps) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border/60 bg-muted/20 p-3 text-sm">
        <p className="text-xs text-muted-foreground">Files</p>
        <ul className="mt-2 space-y-1">
          {entry.fileNames.map((fileName) => (
            <li key={fileName} className="truncate">• {fileName}</li>
          ))}
        </ul>
      </div>
      <div className="flex items-center justify-between rounded-xl border border-border/60 bg-background p-3">
        <p className="text-sm text-muted-foreground">Summary file: {entry.summaryPath}</p>
        <Button size="sm" onClick={() => onOpenSummary(entry.summaryPath)}>
          Open Summary File
        </Button>
      </div>
    </div>
  );
}
