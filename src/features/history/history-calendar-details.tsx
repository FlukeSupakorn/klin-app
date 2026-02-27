import type { HistoryEntry } from "@/features/history/history-types";

interface HistoryCalendarDetailsProps {
  entry: Extract<HistoryEntry, { type: "calendar" }>;
}

export function HistoryCalendarDetails({ entry }: HistoryCalendarDetailsProps) {
  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-border/60 bg-muted/20 p-3 text-sm">
          <p className="text-xs text-muted-foreground">Source File</p>
          <p className="font-medium">{entry.sourceFileName}</p>
        </div>
        <div className="rounded-xl border border-border/60 bg-muted/20 p-3 text-sm">
          <p className="text-xs text-muted-foreground">Meeting Title</p>
          <p className="font-medium">{entry.meetingTitle}</p>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-border/60 bg-muted/20 p-3 text-sm">
          <p className="text-xs text-muted-foreground">Meeting Time</p>
          <p className="font-medium">{entry.meetingTime}</p>
        </div>
        <div className="rounded-xl border border-border/60 bg-muted/20 p-3 text-sm">
          <p className="text-xs text-muted-foreground">Meeting Location</p>
          <p className="font-medium">{entry.meetingLocation}</p>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-border/60 bg-muted/20 p-3 text-sm">
          <p className="text-xs text-muted-foreground">Found in File</p>
          <p className="font-medium">{entry.foundInFile ? "Yes" : "No"}</p>
        </div>
        <div className="rounded-xl border border-border/60 bg-muted/20 p-3 text-sm">
          <p className="text-xs text-muted-foreground">Action</p>
          <p className="font-medium">{entry.actionLabel}</p>
        </div>
      </div>

      <div className="rounded-xl border border-border/60 bg-background p-3 text-sm">
        <p className="text-xs text-muted-foreground">Details</p>
        <p className="font-medium">{entry.details}</p>
      </div>
    </div>
  );
}
