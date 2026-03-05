import {
  ChevronDown,
  ChevronUp,
  Clock,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { theme } from "@/theme/theme";
import type { HistoryEntry } from "@/features/history/history-types";
import { HistoryCalendarDetails } from "@/features/history/history-calendar-details";
import { HistoryOrganizeDetails } from "@/features/history/history-organize-details";
import { HistorySummaryDetails } from "@/features/history/history-summary-details";
import { formatTime, getFolderTail } from "@/features/history/history-utils";

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
  const actionTheme = theme.actions[entry.type];
  const Icon = actionTheme.icon;
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
    <div className={cn("relative overflow-hidden rounded-lg border border-border bg-card transition-colors hover:border-border/80", isExpanded && "border-primary/20 bg-card")}>
      <span className={cn("pointer-events-none absolute bottom-0 left-0 top-0 w-1", actionTheme.accent)} />
      <button type="button" onClick={onToggleExpand} className="w-full text-left">
        <div className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <div className={cn("rounded-lg border p-2", actionTheme.iconWrap)}>
                <Icon className={cn("h-4 w-4", actionTheme.iconColor)} />
              </div>
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className={cn("uppercase", actionTheme.badge)}>{entry.type}</Badge>
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
                      <p className="truncate text-base font-bold" title={displayTitle}>
                        {isRenamed ? (
                          <>
                            <span className="font-normal text-foreground/70">{organizeEntry.oldName}</span>
                            <span className="px-1.5 text-foreground/50">→</span>
                            <span className="font-semibold text-foreground">{organizeEntry.newName}</span>
                          </>
                        ) : (
                          organizeEntry.oldName
                        )}
                      </p>
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
                    <p className="truncate text-base font-bold" title={displayTitle}>{displayTitle}</p>
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
        </div>
      </button>

      {isExpanded && (
        <div className="border-t border-border/50 p-4">
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
        </div>
      )}
    </div>
  );
}
