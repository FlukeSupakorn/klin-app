import { useEffect, useMemo, useState } from "react";
import { History, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { HistoryEntry, HistoryEntryType } from "@/features/history/history-types";
import { tauriClient } from "@/services/tauri-client";
import { historyApiService } from "@/services/history-api-service";
import { HistoryEntryCard } from "@/features/history/history-entry-card";
import { getPathTail, joinPath } from "@/features/history/history-utils";

const TYPE_FILTERS: Array<{ label: string; value: "all" | HistoryEntryType }> = [
  { label: "All", value: "all" },
  { label: "Organize", value: "organize" },
  { label: "Summary", value: "summary" },
  { label: "Calendar", value: "calendar" },
];

export function HistoryPage() {
  const [historyEntries, setHistoryEntries] = useState<HistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | HistoryEntryType>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [scoreExpandedIds, setScoreExpandedIds] = useState<string[]>([]);
  const [selectedScoreByEntryId, setSelectedScoreByEntryId] = useState<Record<string, string>>({});
  const [openedSummaryPath, setOpenedSummaryPath] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadHistory = async () => {
      setIsLoading(true);
      setLoadError(null);

      try {
        const entries = await historyApiService.list();
        if (!isMounted) {
          return;
        }

        setHistoryEntries(entries);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setLoadError(error instanceof Error ? error.message : "Failed to load history");
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadHistory();

    return () => {
      isMounted = false;
    };
  }, []);

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

  const handleUseScoreFolder = (entryId: string, categoryName: string) => {
    const target = historyEntries.find((entry) => entry.id === entryId && entry.type === "organize");
    if (!target || target.type !== "organize") {
      return;
    }

    setSelectedScoreByEntryId((state) => ({ ...state, [entryId]: categoryName }));
    const fileName = getPathTail(target.toPath);
    const nextToPath = joinPath(`C:/Users/supak/Documents/KLIN/${categoryName}`, fileName);
    applyOrganizeDestinationChange(entryId, nextToPath, `Destination changed via score: ${categoryName}`);
  };

  const filteredRows = useMemo(() => {
    return historyEntries.filter((entry) => {
      if (entry.type === "calendar" && !entry.foundInFile) {
        return false;
      }

      const byType = typeFilter === "all" || entry.type === typeFilter;
      const bySearch =
        search.length === 0 ||
        entry.title.toLowerCase().includes(search.toLowerCase()) ||
        entry.subtitle.toLowerCase().includes(search.toLowerCase());
      return byType && bySearch;
    });
  }, [historyEntries, search, typeFilter]);

  const toggleScoreExpansion = (id: string) => {
    setScoreExpandedIds((state) =>
      state.includes(id) ? state.filter((itemId) => itemId !== id) : [...state, id],
    );
  };

  return (
    <div className="space-y-6 pb-10">
      <Card className="border-0 bg-muted/40 shadow-none">
        <CardContent className="space-y-4 p-4">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by title or detail..."
              className="bg-background pl-9"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {TYPE_FILTERS.map((filter) => (
              <Button
                key={filter.value}
                variant={typeFilter === filter.value ? "default" : "outline"}
                size="sm"
                onClick={() => setTypeFilter(filter.value)}
              >
                {filter.label}
              </Button>
            ))}

            <div className="ml-auto flex items-center gap-1.5 whitespace-nowrap rounded-md border border-border/60 bg-background px-2.5 py-1.5 text-xs font-semibold">
              <History className="h-3.5 w-3.5 text-primary" />
              <span className="text-muted-foreground">{historyEntries.length}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {openedSummaryPath && (
        <Card className="border-0 bg-primary/10 shadow-none">
          <CardContent className="flex items-center justify-between gap-4 p-3 text-sm">
            <p className="truncate">Mock open summary file: {openedSummaryPath}</p>
            <Button variant="ghost" size="sm" onClick={() => setOpenedSummaryPath(null)}>
              Dismiss
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {isLoading ? (
          <Card>
            <CardContent className="p-6 text-center text-sm text-muted-foreground">
              Loading history...
            </CardContent>
          </Card>
        ) : loadError ? (
          <Card>
            <CardContent className="p-6 text-center text-sm text-destructive">
              {loadError}
            </CardContent>
          </Card>
        ) : filteredRows.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center text-sm text-muted-foreground">
              No history rows found.
            </CardContent>
          </Card>
        ) : (
          filteredRows.map((entry) => {
            const isExpanded = expandedId === entry.id;

            return (
              <HistoryEntryCard
                key={entry.id}
                entry={entry}
                isExpanded={isExpanded}
                isScoreExpanded={scoreExpandedIds.includes(entry.id)}
                selectedScoreCategory={selectedScoreByEntryId[entry.id]}
                onToggleExpand={() => setExpandedId(isExpanded ? null : entry.id)}
                onToggleScores={() => toggleScoreExpansion(entry.id)}
                onRequestEditMovedTo={handleRequestEditMovedTo}
                onUseScoreFolder={handleUseScoreFolder}
                onOpenSummary={setOpenedSummaryPath}
              />
            );
          })
        )}
      </div>
    </div>
  );
}
