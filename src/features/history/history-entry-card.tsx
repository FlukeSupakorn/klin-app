import {
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Clock,
  FileText,
  FolderSync,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { HistoryEntry, HistoryEntryType } from "@/features/history/history-types";
import { HistoryCalendarDetails } from "@/features/history/history-calendar-details";
import { HistoryOrganizeDetails } from "@/features/history/history-organize-details";
import { HistorySummaryDetails } from "@/features/history/history-summary-details";
import { formatTime, getFolderTail } from "@/features/history/history-utils";

const ACTION_ICON: Record<HistoryEntryType, React.ComponentType<{ className?: string }>> = {
  organize: FolderSync,
  summary: FileText,
  calendar: CalendarDays,
};

interface HistoryEntryCardProps {
  entry: HistoryEntry;
  isExpanded: boolean;
  isScoreExpanded: boolean;
  selectedScoreCategory?: string;
  onToggleExpand: () => void;
  onToggleScores: () => void;
  onRequestEditMovedTo: (entryId: string) => void;
  onUseScoreFolder: (entryId: string, categoryName: string) => void;
  onOpenSummary: (path: string) => void;
}

export function HistoryEntryCard({
  entry,
  isExpanded,
  isScoreExpanded,
  selectedScoreCategory,
  onToggleExpand,
  onToggleScores,
  onRequestEditMovedTo,
  onUseScoreFolder,
  onOpenSummary,
}: HistoryEntryCardProps) {
  const Icon = ACTION_ICON[entry.type];
  const organizeEntry = entry.type === "organize" ? entry : null;
  const calendarEntry = entry.type === "calendar" ? entry : null;
  const isRenamed = organizeEntry ? organizeEntry.oldName !== organizeEntry.newName : false;
  const isMoved = organizeEntry ? organizeEntry.fromPath !== organizeEntry.toPath : false;

  const displayTitle = organizeEntry
    ? (isRenamed ? `${organizeEntry.oldName} → ${organizeEntry.newName}` : organizeEntry.oldName)
    : (calendarEntry ? calendarEntry.meetingTitle : entry.title);

  const displaySubtitle = organizeEntry
    ? (isMoved
      ? `Move: ${getFolderTail(organizeEntry.fromPath)} → ${getFolderTail(organizeEntry.toPath)}`
      : "No move")
    : (calendarEntry
      ? `From: ${calendarEntry.sourceFileName} · Meet: ${calendarEntry.meetingTime}`
      : entry.subtitle);

  return (
    <Card className={cn("overflow-hidden transition-colors", isExpanded && "bg-muted/20")}>
      <button type="button" onClick={onToggleExpand} className="w-full text-left">
        <CardHeader className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <div className="rounded-lg border border-border/60 bg-muted/30 p-2">
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="uppercase">{entry.type}</Badge>
                  {entry.type === "organize" && (
                    <Badge variant="secondary" className="gap-1">
                      <Sparkles className="h-3 w-3" />
                      Top: {entry.scores[0]?.name ?? "-"} {Math.round((entry.scores[0]?.score ?? 0) * 100)}%
                    </Badge>
                  )}
                </div>

                {organizeEntry ? (
                  <>
                    <div className="min-w-0">
                      <CardTitle className="truncate text-lg" title={displayTitle}>
                        {isRenamed ? (
                          <>
                            <span className="font-normal text-foreground/70">{organizeEntry.oldName}</span>
                            <span className="px-1.5 text-foreground/50">→</span>
                            <span className="font-semibold text-foreground">{organizeEntry.newName}</span>
                          </>
                        ) : (
                          organizeEntry.oldName
                        )}
                      </CardTitle>
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm text-foreground/80" title={displaySubtitle}>
                        {isMoved ? (
                          <>
                            <span>Move: </span>
                            <span className="font-normal text-foreground/65">{getFolderTail(organizeEntry.fromPath)}</span>
                            <span className="px-1 text-foreground/50">→</span>
                            <span className="font-medium text-foreground">{getFolderTail(organizeEntry.toPath)}</span>
                          </>
                        ) : (
                          "No move"
                        )}
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <CardTitle className="truncate text-lg" title={displayTitle}>{displayTitle}</CardTitle>
                    <p className="truncate text-sm text-muted-foreground" title={displaySubtitle}>{displaySubtitle}</p>
                  </>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatTime(entry.timestamp)}
              </span>
              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </div>
          </div>
        </CardHeader>
      </button>

      {isExpanded && (
        <CardContent className="border-t border-border/50 p-4">
          {entry.type === "organize" && (
            <HistoryOrganizeDetails
              entry={entry}
              isShowAllScores={isScoreExpanded}
              selectedScoreCategory={selectedScoreCategory}
              onToggleScores={onToggleScores}
              onRequestEditMovedTo={onRequestEditMovedTo}
              onUseScoreFolder={onUseScoreFolder}
            />
          )}

          {entry.type === "summary" && (
            <HistorySummaryDetails entry={entry} onOpenSummary={onOpenSummary} />
          )}

          {entry.type === "calendar" && <HistoryCalendarDetails entry={entry} />}
        </CardContent>
      )}
    </Card>
  );
}
