import { ArrowRight, FileText } from "lucide-react";
import { Link } from "react-router-dom";
import type { HistoryEntry } from "@/types/history";
import { formatTime, getFolderTail } from "@/features/history/history-utils";

const ENTRY_COLORS: Record<string, string> = {
  organize: "var(--primary)",
  summary: "var(--secondary-foreground)",
  calendar: "var(--success)",
};

function confColor(c: number): string {
  return c >= 80 ? "var(--success)" : c >= 65 ? "var(--warning)" : "var(--destructive)";
}

interface RecentMovementsSectionProps {
  recentEntries: HistoryEntry[];
  onOpenEntry: (entryId: string) => void;
}

export function RecentMovementsSection({ recentEntries, onOpenEntry }: RecentMovementsSectionProps) {
  const getTitle = (entry: HistoryEntry): string => {
    if (entry.type === "organize") return entry.oldName !== entry.newName ? `${entry.oldName} → ${entry.newName}` : entry.newName;
    if (entry.type === "summary") return entry.title;
    return entry.meetingTitle || entry.title;
  };

  return (
    <div
      className="overflow-hidden rounded-[18px] border border-border bg-card"
      style={{ boxShadow: "var(--shadow-xs)" }}
    >
      <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
        <div>
          <div className="text-[13px] font-extrabold text-foreground">Recent Movements</div>
          <div className="text-[11px] text-muted-foreground">Latest file operations</div>
        </div>
        <Link
          to="/history"
          className="text-[12px] font-bold text-primary transition-colors hover:opacity-70"
        >
          View all →
        </Link>
      </div>

      <div className="divide-y divide-border">
        {recentEntries.length === 0 ? (
          <div className="py-10 text-center text-[13px] text-muted-foreground">
            No movement history yet.
          </div>
        ) : (
          recentEntries.map((entry) => {
            const iconBg = ENTRY_COLORS[entry.type] ?? ENTRY_COLORS.organize;
            const organizeEntry = entry.type === "organize" ? entry : null;
            const conf = organizeEntry ? Math.round((organizeEntry.scores[0]?.score ?? 0) * 100) : 0;
            const fromFolder = organizeEntry ? getFolderTail(organizeEntry.fromPath) : null;
            const topCat = organizeEntry?.scores[0]?.name ?? null;
            const toFolder = organizeEntry ? getFolderTail(organizeEntry.toPath) : null;

            return (
              <button
                key={entry.id}
                type="button"
                onClick={() => onOpenEntry(entry.id)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40"
              >
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px]"
                  style={{ background: iconBg }}
                >
                  <FileText className="h-[15px] w-[15px] text-white" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12.5px] font-bold text-foreground">{getTitle(entry)}</div>
                  {organizeEntry && (fromFolder || topCat) && (
                    <div className="mt-0.5 flex items-center gap-1.5">
                      <span className="truncate text-[10.5px] text-muted-foreground" style={{ maxWidth: 90 }}>
                        {fromFolder}
                      </span>
                      <ArrowRight className="h-2.5 w-2.5 shrink-0 text-primary" />
                      <span
                        className="truncate text-[10.5px] font-bold text-primary"
                        style={{ maxWidth: 90 }}
                      >
                        {topCat || toFolder}
                      </span>
                    </div>
                  )}
                  {!organizeEntry && (
                    <div className="mt-0.5 truncate text-[10.5px] text-muted-foreground">
                      {entry.subtitle}
                    </div>
                  )}
                </div>

                <div className="shrink-0 text-right">
                  {conf > 0 && (
                    <div className="text-[11px] font-bold" style={{ color: confColor(conf) }}>
                      {conf}%
                    </div>
                  )}
                  <div className="mt-0.5 text-[10px] text-muted-foreground">
                    {formatTime(entry.timestamp)}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
