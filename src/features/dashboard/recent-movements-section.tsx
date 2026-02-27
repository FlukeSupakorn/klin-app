import { CalendarDays, ChevronRight, Clock, FileText, FolderSync } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { HistoryEntry, HistoryEntryType } from "@/features/history/history-types";
import { formatTime, getFolderTail, getPathTail } from "@/features/history/history-utils";

interface RecentMovementsSectionProps {
  recentEntries: HistoryEntry[];
  onOpenEntry: (entryId: string) => void;
}

const ACTION_ICON: Record<HistoryEntryType, React.ComponentType<{ className?: string }>> = {
  organize: FolderSync,
  summary: FileText,
  calendar: CalendarDays,
};

export function RecentMovementsSection({ recentEntries, onOpenEntry }: RecentMovementsSectionProps) {
  const getEntryTitle = (entry: HistoryEntry): string => {
    if (entry.type === "organize") {
      return entry.oldName !== entry.newName ? `${entry.oldName} → ${entry.newName}` : entry.newName;
    }

    if (entry.type === "summary") {
      return entry.title;
    }

    return entry.meetingTitle || entry.title;
  };

  const getEntrySubtitle = (entry: HistoryEntry): string => {
    if (entry.type === "organize") {
      return `${getFolderTail(entry.fromPath)} → ${getFolderTail(entry.toPath)}`;
    }

    if (entry.type === "summary") {
      return `${entry.fileNames.length} files · ${getPathTail(entry.summaryPath)}`;
    }

    return `${entry.sourceFileName} · ${entry.meetingTime}`;
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-semibold">Recent Movements</h3>
        <Link to="/history" className="text-sm font-medium text-primary hover:underline">
          View all history
        </Link>
      </div>
      <div className="space-y-2">
        {recentEntries.length === 0 ? (
          <div className="rounded-2xl border border-dashed bg-muted/20 py-8 text-center text-sm text-muted-foreground">
            No movement history yet.
          </div>
        ) : (
          recentEntries.map((entry) => {
            const Icon = ACTION_ICON[entry.type];

            return (
            <Card key={entry.id} className="overflow-hidden border bg-muted/30 shadow-none transition-colors hover:bg-muted/40">
              <button type="button" onClick={() => onOpenEntry(entry.id)} className="w-full text-left">
                <CardContent className="p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="h-5 px-1.5 py-0 text-[10px] uppercase">
                        {entry.type}
                      </Badge>
                      <span className="rounded-md border border-border/60 bg-background p-1.5">
                        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                      </span>
                      <p className="max-w-[360px] truncate text-sm font-semibold" title={getEntryTitle(entry)}>
                        {getEntryTitle(entry)}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span className="truncate max-w-[420px]" title={getEntrySubtitle(entry)}>{getEntrySubtitle(entry)}</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatTime(entry.timestamp)}
                      </span>
                      {entry.type === "organize" && (
                        <span className="font-semibold text-primary">
                          {Math.round((entry.scores[0]?.score ?? 0) * 100)}%
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-background text-muted-foreground">
                    <ChevronRight className="h-4 w-4" />
                  </div>
                </div>
                </CardContent>
              </button>
            </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
