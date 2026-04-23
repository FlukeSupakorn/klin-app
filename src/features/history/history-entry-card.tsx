import { ArrowRight, ChevronDown, ChevronUp, Clock, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { findCategoryColor } from "@/lib/category-utils";
import { useCategoryManagementStore } from "@/stores/use-category-management-store";
import type { HistoryEntry } from "@/types/history";
import { HistoryCalendarDetails } from "@/features/history/history-calendar-details";
import { HistoryOrganizeDetails } from "@/features/history/history-organize-details";
import { HistorySummaryDetails } from "@/features/history/history-summary-details";
import { formatTime, getFolderTail } from "@/features/history/history-utils";

const ENTRY_GRADIENTS: Record<string, string> = {
  organize: "linear-gradient(135deg,#4a7cf7,#7c3aed)",
  summary: "linear-gradient(135deg,#8b5cf6,#6d28d9)",
  calendar: "linear-gradient(135deg,#10b981,#0891b2)",
};

function confColor(c: number): string {
  return c >= 80 ? "#10b981" : c >= 65 ? "#d97706" : "#ef4444";
}

interface HistoryEntryCardProps {
  entry: HistoryEntry;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onRequestEditMovedTo: (entryId: string) => void;
  onOpenSummary: (path: string) => void;
}

export function HistoryEntryCard({
  entry,
  isExpanded,
  onToggleExpand,
  onRequestEditMovedTo,
  onOpenSummary,
}: HistoryEntryCardProps) {
  const categories = useCategoryManagementStore((state) => state.categories);

  const organizeEntry = entry.type === "organize" ? entry : null;
  const calendarEntry = entry.type === "calendar" ? entry : null;

  const topCategoryName = organizeEntry?.scores[0]?.name ?? "";
  const topCategoryScore = Math.round((organizeEntry?.scores[0]?.score ?? 0) * 100);
  const topCategoryColor = findCategoryColor(topCategoryName, categories);

  const grad = topCategoryColor
    ? `linear-gradient(135deg,${topCategoryColor},${topCategoryColor}bb)`
    : ENTRY_GRADIENTS[entry.type] ?? ENTRY_GRADIENTS.organize;

  const fileName = organizeEntry?.oldName ?? (calendarEntry?.meetingTitle ?? entry.title);
  const fromFolder = organizeEntry ? getFolderTail(organizeEntry.fromPath) : null;
  const toFolder = organizeEntry ? getFolderTail(organizeEntry.toPath) : null;

  return (
    <div
      className={cn(
        "overflow-hidden rounded-[14px] border border-border bg-card transition-all",
        isExpanded && "border-primary/20",
      )}
      style={{ boxShadow: "0 2px 10px rgba(74,124,247,0.06)" }}
    >
      <button type="button" onClick={onToggleExpand} className="w-full text-left">
        <div className="flex items-center gap-0">
          {/* Left gradient strip */}
          <div
            className="w-1 self-stretch shrink-0"
            style={{ background: grad, borderRadius: "14px 0 0 14px" }}
          />

          <div className="flex flex-1 items-center gap-3.5 px-4 py-3">
            {/* Gradient icon */}
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px]"
              style={{ background: grad }}
            >
              <FileText className="h-[17px] w-[17px] text-white" />
            </div>

            {/* Main content */}
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13.5px] font-extrabold text-foreground">
                {fileName}
              </div>

              {organizeEntry && (
                <div className="mt-1.5 flex items-center gap-2">
                  <div
                    className="rounded-[7px] border px-2.5 py-0.5 text-[11px] font-semibold text-muted-foreground"
                    style={{ background: "var(--muted)", borderColor: "var(--border)", maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                    title={fromFolder ?? ""}
                  >
                    {fromFolder}
                  </div>
                  <ArrowRight className="h-3 w-3 shrink-0 text-primary" />
                  <div
                    className="rounded-[7px] border px-2.5 py-0.5 text-[11px] font-bold"
                    style={{
                      background: "rgba(74,124,247,0.08)",
                      borderColor: "rgba(74,124,247,0.2)",
                      color: "#4a7cf7",
                      maxWidth: 140,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                    title={topCategoryName || toFolder || ""}
                  >
                    {topCategoryName || toFolder}
                  </div>
                </div>
              )}

              {!organizeEntry && (
                <div className="mt-0.5 truncate text-[11.5px] text-muted-foreground">
                  {calendarEntry
                    ? `${calendarEntry.sourceFileName} · ${calendarEntry.meetingTime}`
                    : entry.subtitle}
                </div>
              )}
            </div>

            {/* Right: confidence + time + chevron */}
            <div className="flex shrink-0 flex-col items-end gap-1.5">
              {organizeEntry && topCategoryScore > 0 && (
                <div className="flex items-center gap-2">
                  <div className="h-[5px] w-9 rounded-full" style={{ background: "var(--border)" }}>
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${topCategoryScore}%`, background: confColor(topCategoryScore) }}
                    />
                  </div>
                  <span className="text-[12px] font-extrabold" style={{ color: confColor(topCategoryScore) }}>
                    {topCategoryScore}%
                  </span>
                </div>
              )}
              <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <Clock className="h-2.5 w-2.5" />
                {formatTime(entry.timestamp)}
              </div>
            </div>

            <div className={cn("ml-1 shrink-0 transition-transform duration-200", isExpanded && "rotate-180")}>
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
          </div>
        </div>
      </button>

      {isExpanded && (
        <div
          className="border-t border-border px-5 py-4"
          style={{ background: "rgba(74,124,247,0.02)", animation: "klin-fade-in 0.2s ease" }}
        >
          {entry.type === "organize" && (
            <HistoryOrganizeDetails entry={entry} onRequestEditMovedTo={onRequestEditMovedTo} />
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
