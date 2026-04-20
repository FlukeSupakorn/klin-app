import type { HistoryEntry } from "@/types/history";

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
          <p className="text-xs text-muted-foreground">Organizer</p>
          <p className="font-medium">{entry.organizer || "-"}</p>
        </div>
        <div className="rounded-xl border border-border/60 bg-muted/20 p-3 text-sm">
          <p className="text-xs text-muted-foreground">Time Zone</p>
          <p className="font-medium">{entry.timeZone || "-"}</p>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-border/60 bg-muted/20 p-3 text-sm">
          <p className="text-xs text-muted-foreground">Status</p>
          <p className="font-medium">{entry.status || "-"}</p>
        </div>
        <div className="rounded-xl border border-border/60 bg-muted/20 p-3 text-sm">
          <p className="text-xs text-muted-foreground">Calendar</p>
          <p className="font-medium">{entry.calendarId || "-"}</p>
        </div>
      </div>

      <div className="rounded-xl border border-border/60 bg-muted/20 p-3 text-sm">
        <p className="text-xs text-muted-foreground">Attendees</p>
        <p className="font-medium">{entry.attendees && entry.attendees.length > 0 ? entry.attendees.join(", ") : "-"}</p>
      </div>

      <div className="rounded-xl border border-border/60 bg-muted/20 p-3 text-sm">
        <p className="text-xs text-muted-foreground">Meet Link</p>
        {entry.meetLink ? (
          <a
            href={entry.meetLink}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-primary hover:underline"
          >
            {entry.meetLink}
          </a>
        ) : (
          <p className="font-medium">-</p>
        )}
      </div>

      <div className="rounded-xl border border-border/60 bg-muted/20 p-3 text-sm">
        <p className="text-xs text-muted-foreground">Action</p>
        <p className="font-medium">{entry.actionLabel}</p>
      </div>

      <div className="rounded-xl border border-border/60 bg-background p-3 text-sm">
        <p className="text-xs text-muted-foreground">Details</p>
        <p className="font-medium">{entry.details}</p>
      </div>
    </div>
  );
}
