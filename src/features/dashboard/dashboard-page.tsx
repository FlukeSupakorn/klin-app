import { useCallback, useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { OrganizeFilesPanel } from "@/features/dashboard/organize-files-panel";
import { WatcherOverviewCard } from "@/features/dashboard/watcher-overview-card";
import { RecentMovementsSection } from "@/features/dashboard/recent-movements-section";
import type { HistoryEntry } from "@/types/history";
import { historyApiService } from "@/services/history-api-service";
import { FileText, ArrowRight } from "lucide-react";

export function DashboardPage() {
  const navigate = useNavigate();
  const [recentHistoryEntries, setRecentHistoryEntries] = useState<HistoryEntry[]>([]);

  const loadRecentHistory = useCallback(async () => {
    try {
      const firstPage = await historyApiService.list({ limit: 20, offset: 0 });
      const rows = firstPage.entries
        .sort((left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime())
        .slice(0, 5);
      setRecentHistoryEntries(rows);
    } catch {
      setRecentHistoryEntries([]);
    }
  }, []);

  useEffect(() => {
    void loadRecentHistory();

    const onHistoryUpdated = () => {
      void loadRecentHistory();
    };

    window.addEventListener("klin:history-updated", onHistoryUpdated);

    return () => {
      window.removeEventListener("klin:history-updated", onHistoryUpdated);
    };
  }, [loadRecentHistory]);

  const handleOpenRecentHistoryEntry = (entryId: string) => {
    navigate("/history", { state: { expandedEntryId: entryId } });
  };

  return (
    <div className="space-y-7 pb-12">
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Home</p>
        <h2 className="font-syne text-2xl font-black uppercase tracking-tight">Dashboard</h2>
      </div>

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,1fr)]">
      <section className="space-y-6">
        <OrganizeFilesPanel />
        <RecentMovementsSection
          recentEntries={recentHistoryEntries}
          onOpenEntry={handleOpenRecentHistoryEntry}
        />
      </section>

      <section className="space-y-6">
        <WatcherOverviewCard />

        <Link to="/notes" className="block">
          <div className="group flex items-center justify-between rounded-2xl bg-card px-6 py-5 shadow-xs ring-1 ring-border/70 transition-all duration-150 hover:bg-accent/70">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                <FileText className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Quick Access</p>
                <p className="text-sm font-semibold text-foreground">Notes</p>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform duration-150 group-hover:translate-x-1 group-hover:text-primary" />
          </div>
        </Link>

        <Link to="/calendar" className="block">
          <div className="group flex items-center justify-between rounded-2xl bg-card px-6 py-5 shadow-xs ring-1 ring-border/70 transition-all duration-150 hover:bg-accent/70">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-secondary/15 text-secondary">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Quick Access</p>
                <p className="text-sm font-semibold text-foreground">Calendar</p>
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
