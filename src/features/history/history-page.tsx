import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { History, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 250);

    return () => {
      window.clearTimeout(timer);
    };
  }, [search]);

  const loadHistoryPage = useCallback(async (reset: boolean) => {
    if (reset) {
      setIsLoading(true);
      setLoadError(null);
    } else {
      setIsLoadingMore(true);
    }

    const requestOffset = reset ? 0 : nextOffset;

    try {
      const page = await historyApiService.list({
        limit: HISTORY_PAGE_SIZE,
        offset: requestOffset,
        search: debouncedSearch,
      });

      setHistoryEntries((state) => {
        if (reset) {
          return page.entries;
        }

        const merged = [...state, ...page.entries];
        const deduped = new Map<string, HistoryEntry>();
        merged.forEach((entry) => {
          deduped.set(entry.id, entry);
        });

        return [...deduped.values()];
      });

      setHasMore(page.hasMore);
      setNextOffset(requestOffset + page.entries.length);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Failed to load history");
    } finally {
      if (reset) {
        setIsLoading(false);
      } else {
        setIsLoadingMore(false);
      }
    }
  }, [debouncedSearch, nextOffset]);

  useEffect(() => {
    void loadHistoryPage(true);
  }, [debouncedSearch]);

  useEffect(() => {
    const target = loadMoreRef.current;
    if (!target || !hasMore || isLoading || isLoadingMore) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting) && hasMore && !isLoadingMore && !isLoading) {
          void loadHistoryPage(false);
        }
      },
      { rootMargin: "160px" },
    );

    observer.observe(target);
    return () => {
      observer.disconnect();
    };
  }, [hasMore, isLoading, isLoadingMore, loadHistoryPage]);

  useEffect(() => {
    if (!expandedEntryIdFromNavState) {
      return;
    }

    const targetExists = historyEntries.some((entry) => entry.id === expandedEntryIdFromNavState);
    if (!targetExists) {
      return;
    }

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
      if (!target || target.type !== "organize" || target.toPath === nextToPath) {
        return state;
      }

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
    if (!target || target.type !== "organize") {
      return;
    }

    const pickedFolder = await tauriClient.pickFolderForOrganize();
    if (!pickedFolder) {
      return;
    }

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

  const handleOpenSummary = useCallback((path: string) => {
    void tauriClient.openExternalUrl(path);
  }, []);

  return (
    <div className="space-y-6 pb-10">
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Activity</p>
        <h2 className="font-syne text-2xl font-black uppercase tracking-tight">History</h2>
      </div>

      <div className="space-y-3">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by title or detail..."
            className="border-border bg-muted/50 pl-9 focus:border-primary/50"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {TYPE_FILTERS.map((filter) => (
            <button
              key={filter.value}
              onClick={() => setTypeFilter(filter.value)}
              className={cn(
                "rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-widest transition-colors",
                typeFilter === filter.value
                  ? "bg-primary/15 text-primary"
                  : "bg-muted text-muted-foreground hover:text-foreground",
              )}
            >
              {filter.label}
            </button>
          ))}

          <div className="ml-auto flex items-center gap-1.5 whitespace-nowrap rounded-full border border-border bg-muted px-3 py-1.5 text-[10px] font-black uppercase tracking-widest">
            <History className="h-3 w-3 text-primary" />
            <span className="text-muted-foreground">{historyEntries.length} entries</span>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {isLoading ? (
          <div className="rounded-lg border border-border bg-card p-6 text-center text-sm text-muted-foreground">
            Loading history...
          </div>
        ) : loadError ? (
          <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-6 text-center text-sm text-destructive">
            {loadError}
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-6 text-center text-sm text-muted-foreground">
            No history rows found.
          </div>
        ) : (
          <>
            {filteredRows.map((entry) => {
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

            {isLoadingMore && (
              <div className="rounded-lg border border-border bg-card p-4 text-center text-sm text-muted-foreground">
                Loading more history...
              </div>
            )}

            {!hasMore && historyEntries.length > 0 && (
              <div className="rounded-lg border border-border bg-card p-4 text-center text-sm text-muted-foreground">
                End of history.
              </div>
            )}

            <div ref={loadMoreRef} className="h-2" />
          </>
        )}
      </div>
    </div>
  );
}
