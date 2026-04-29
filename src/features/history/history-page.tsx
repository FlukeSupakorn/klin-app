import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { History, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import type { HistoryEntry, HistoryEntryType } from "@/types/history";
import { tauriClient } from "@/services/tauri-client";
import { historyApiService } from "@/services/history-api-service";
import { HistoryEntryCard } from "@/features/history/history-entry-card";
import { getPathTail, joinPath } from "@/features/history/history-utils";
import { useCategoryManagementStore } from "@/stores/use-category-management-store";

const HISTORY_PAGE_SIZE = 20;

const TYPE_FILTERS: Array<{ label: string; value: "all" | HistoryEntryType }> = [
  { label: "All", value: "all" },
  { label: "Organize", value: "organize" },
  { label: "Note", value: "summary" },
  { label: "Calendar", value: "calendar" },
];

function groupByDate(entries: HistoryEntry[]): Array<{ label: string; items: HistoryEntry[] }> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const groups = new Map<string, HistoryEntry[]>();
  for (const entry of entries) {
    const d = new Date(entry.timestamp);
    d.setHours(0, 0, 0, 0);
    let label: string;
    if (d.getTime() === today.getTime()) label = `Today — ${today.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`;
    else if (d.getTime() === yesterday.getTime()) label = `Yesterday — ${yesterday.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`;
    else label = d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label)!.push(entry);
  }
  return Array.from(groups.entries()).map(([label, items]) => ({ label, items }));
}

export function HistoryPage() {
  const location = useLocation();
  const [historyEntries, setHistoryEntries] = useState<HistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [nextOffset, setNextOffset] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | HistoryEntryType>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const categoryDefaultFolder = useCategoryManagementStore((state) => state.defaultFolder);

  const expandedEntryIdFromNavState =
    location.state && typeof location.state === "object" && "expandedEntryId" in location.state
      ? String((location.state as { expandedEntryId?: string }).expandedEntryId ?? "")
      : "";

  useEffect(() => {
    const timer = window.setTimeout(() => { setDebouncedSearch(search.trim()); }, 250);
    return () => { window.clearTimeout(timer); };
  }, [search]);

  const loadHistoryPage = useCallback(async (reset: boolean) => {
    if (reset) { setIsLoading(true); setLoadError(null); }
    else { setIsLoadingMore(true); }
    const requestOffset = reset ? 0 : nextOffset;
    try {
      const page = await historyApiService.list({ limit: HISTORY_PAGE_SIZE, offset: requestOffset, search: debouncedSearch });
      setHistoryEntries((state) => {
        if (reset) return page.entries;
        const merged = [...state, ...page.entries];
        const deduped = new Map<string, HistoryEntry>();
        merged.forEach((entry) => { deduped.set(entry.id, entry); });
        return [...deduped.values()];
      });
      setHasMore(page.hasMore);
      setNextOffset(requestOffset + page.entries.length);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Failed to load history");
    } finally {
      if (reset) setIsLoading(false);
      else setIsLoadingMore(false);
    }
  }, [debouncedSearch, nextOffset]);

  useEffect(() => { void loadHistoryPage(true); }, [debouncedSearch]);

  useEffect(() => {
    const onHistoryUpdated = () => { void loadHistoryPage(true); };
    window.addEventListener("klin:history-updated", onHistoryUpdated);
    return () => { window.removeEventListener("klin:history-updated", onHistoryUpdated); };
  }, [loadHistoryPage]);

  useEffect(() => {
    const target = loadMoreRef.current;
    if (!target || !hasMore || isLoading || isLoadingMore) return;
    const observer = new IntersectionObserver(
      (entries) => { if (entries.some((entry) => entry.isIntersecting) && hasMore && !isLoadingMore && !isLoading) void loadHistoryPage(false); },
      { rootMargin: "160px" },
    );
    observer.observe(target);
    return () => { observer.disconnect(); };
  }, [hasMore, isLoading, isLoadingMore, loadHistoryPage]);

  useEffect(() => {
    if (!expandedEntryIdFromNavState) return;
    const targetExists = historyEntries.some((entry) => entry.id === expandedEntryIdFromNavState);
    if (!targetExists) return;
    setTypeFilter("all");
    setSearch("");
    setExpandedId(expandedEntryIdFromNavState);
  }, [expandedEntryIdFromNavState, historyEntries]);

  const appendDestinationChangeHistory = (
    previous: Extract<HistoryEntry, { type: "organize" }>,
    nextToPath: string,
    reason: string,
  ) => {
    const fileName = getPathTail(nextToPath);
    return {
      ...previous,
      id: `h-edit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: fileName,
      subtitle: reason,
      timestamp: new Date().toISOString(),
      fromPath: previous.toPath,
      toPath: nextToPath,
      oldName: fileName,
      newName: fileName,
    } satisfies Extract<HistoryEntry, { type: "organize" }>;
  };

  const applyOrganizeDestinationChange = (entryId: string, nextToPath: string, reason: string) => {
    setHistoryEntries((state) => {
      const target = state.find((entry) => entry.id === entryId && entry.type === "organize");
      if (!target || target.type !== "organize" || target.toPath === nextToPath) return state;
      const updated = state.map((entry) =>
        entry.id === entryId && entry.type === "organize"
          ? { ...entry, toPath: nextToPath, timestamp: new Date().toISOString() }
          : entry,
      );
      const newHistory = appendDestinationChangeHistory(target, nextToPath, reason);
      return [newHistory, ...updated];
    });
  };

  const handleRequestEditMovedTo = async (entryId: string) => {
    const target = historyEntries.find((entry) => entry.id === entryId && entry.type === "organize");
    if (!target || target.type !== "organize") return;
    const pickedFolder = await tauriClient.pickFolderForOrganize();
    if (!pickedFolder) return;
    const fileName = getPathTail(target.toPath);
    applyOrganizeDestinationChange(entryId, joinPath(pickedFolder, fileName), "Destination updated manually");
  };

  const filteredRows = useMemo(() => {
    return historyEntries.filter((entry) => {
      const byType = typeFilter === "all" || entry.type === typeFilter;
      const bySearch =
        search.length === 0 ||
        entry.title.toLowerCase().includes(search.toLowerCase()) ||
        entry.subtitle.toLowerCase().includes(search.toLowerCase());
      return byType && bySearch;
    });
  }, [historyEntries, search, typeFilter]);

  const grouped = useMemo(() => groupByDate(filteredRows), [filteredRows]);

  const handleOpenSummary = useCallback((path: string) => {
    void tauriClient.openExternalUrl(path);
  }, []);

  return (
    <div className="flex h-full flex-col gap-5">
      {/* Header row */}
      <div className="flex shrink-0 items-center gap-3">
        <div className="flex items-center gap-3 flex-1">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px]"
            style={{ background: "var(--primary)" }}>
            <History className="h-4 w-4 text-white" />
          </div>
          <div>
            <div className="text-[10.5px] font-extrabold uppercase tracking-widest text-muted-foreground">Activity</div>
            <h1 className="text-[21px] font-extrabold tracking-tight text-foreground" style={{ letterSpacing: "-0.4px" }}>
              Activity History
            </h1>
          </div>
        </div>

        {/* Search */}
        <div
          className="flex w-[200px] items-center gap-2 rounded-[12px] border border-border bg-card px-3"
          style={{ boxShadow: "var(--shadow-xs)" }}
        >
          <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search files..."
            className="h-9 flex-1 bg-transparent text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
        </div>

        {/* Filter pills */}
        <div
          className="flex gap-1 rounded-[12px] border border-border bg-card p-1"
          style={{ boxShadow: "var(--shadow-xs)" }}
        >
          {TYPE_FILTERS.map((f) => {
            const active = typeFilter === f.value;
            return (
              <button
                key={f.value}
                onClick={() => setTypeFilter(f.value)}
                className={cn(
                  "rounded-[9px] px-3.5 py-1.5 text-[12.5px] font-bold transition-all",
                  active ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground",
                )}
                style={active ? { boxShadow: "0 3px 8px var(--primary-glow)" } : {}}
              >
                {f.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="rounded-[14px] border border-border bg-card p-6 text-center text-sm text-muted-foreground">
            Loading history...
          </div>
        ) : loadError ? (
          <div className="rounded-[14px] border border-destructive/20 bg-destructive/10 p-6 text-center text-sm text-destructive">
            {loadError}
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="rounded-[14px] border border-border bg-card p-6 text-center text-sm text-muted-foreground">
            No history rows found.
          </div>
        ) : (
          <div className="space-y-6 pb-8">
            {grouped.map((group) => (
              <div key={group.label}>
                <div className="mb-2.5 pl-1 text-[11px] font-extrabold uppercase tracking-widest text-muted-foreground">
                  {group.label}
                </div>
                <div className="space-y-2">
                  {group.items.map((entry) => {
                    const isExpanded = expandedId === entry.id;
                    return (
                      <HistoryEntryCard
                        key={entry.id}
                        entry={entry}
                        isExpanded={isExpanded}
                        onToggleExpand={() => setExpandedId(isExpanded ? null : entry.id)}
                        onRequestEditMovedTo={handleRequestEditMovedTo}
                        onOpenSummary={handleOpenSummary}
                      />
                    );
                  })}
                </div>
              </div>
            ))}

            {isLoadingMore && (
              <div className="rounded-[14px] border border-border bg-card p-4 text-center text-sm text-muted-foreground">
                Loading more...
              </div>
            )}

            {!hasMore && historyEntries.length > 0 && (
              <div className="rounded-[14px] border border-border bg-card p-4 text-center text-sm text-muted-foreground">
                End of history.
              </div>
            )}

            <div ref={loadMoreRef} className="h-2" />
          </div>
        )}
      </div>
    </div>
  );
}
