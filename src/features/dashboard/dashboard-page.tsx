import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { OrganizeFilesPanel } from "@/features/dashboard/organize-files-panel";
import { WatcherOverviewCard } from "@/features/dashboard/watcher-overview-card";
import { RecentMovementsSection } from "@/features/dashboard/recent-movements-section";
import type { HistoryEntry } from "@/features/history/history-types";
import { historyApiService } from "@/services/history-api-service";
import { FileText, ArrowRight } from "lucide-react";

export function DashboardPage() {
  const navigate = useNavigate();
  const [recentHistoryEntries, setRecentHistoryEntries] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    void (async () => {
      try {
        const historyRows = await historyApiService.list();
        const rows = historyRows
          .sort((left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime())
          .slice(0, 5);
        setRecentHistoryEntries(rows);
      } catch {
        setRecentHistoryEntries([]);
      }
    })();
  }, []);

  const handleOpenRecentHistoryEntry = (entryId: string) => {
    navigate("/history", { state: { expandedEntryId: entryId } });
  };

  return (
    <div className="space-y-6 pb-10">
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Home</p>
        <h2 className="font-syne text-2xl font-black uppercase tracking-tight">Dashboard</h2>
      </div>

      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(300px,1fr)]">
      <section className="space-y-5">
        <OrganizeFilesPanel />
        <RecentMovementsSection
          recentEntries={recentHistoryEntries}
          onOpenEntry={handleOpenRecentHistoryEntry}
        />
      </section>

      <section className="space-y-5">
        <WatcherOverviewCard />

        <Link to="/notes" className="block">
          <div className="group flex items-center justify-between rounded-2xl border border-border bg-card px-5 py-4 transition-all duration-150 hover:border-primary/30 hover:bg-muted/60">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <FileText className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Quick Access</p>
                <p className="text-sm font-bold text-foreground">Notes</p>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform duration-150 group-hover:translate-x-1 group-hover:text-primary" />
          </div>
        </Link>

        <Link to="/calendar" className="block">
          <div className="group flex items-center justify-between rounded-2xl border border-border bg-card px-5 py-4 transition-all duration-150 hover:border-primary/30 hover:bg-muted/60">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary/10 text-secondary">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Quick Access</p>
                <p className="text-sm font-bold text-foreground">Calendar</p>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform duration-150 group-hover:translate-x-1 group-hover:text-secondary" />
          </div>
        </Link>
      </section>
      </div>
    </div>
  );
}
