import { useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Clock,
  FileText,
  FolderSync,
  History,
  Pencil,
  Search,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { tauriClient } from "@/services/tauri-client";
import mockHistoryEntries, {
  type HistoryEntry,
  type HistoryEntryType,
} from "@/features/history/history-mock-data";

const TYPE_FILTERS: Array<{ label: string; value: "all" | HistoryEntryType }> = [
  { label: "All", value: "all" },
  { label: "Organize", value: "organize" },
  { label: "Summary", value: "summary" },
  { label: "Calendar", value: "calendar" },
];

const ACTION_ICON: Record<HistoryEntryType, React.ComponentType<{ className?: string }>> = {
  organize: FolderSync,
  summary: FileText,
  calendar: CalendarDays,
};

function formatTime(value: string) {
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getPathTail(value: string) {
  const normalized = value.replace(/\\/g, "/");
  const parts = normalized.split("/").filter(Boolean);
  return parts[parts.length - 1] ?? value;
}

function getFolderTail(value: string) {
  const normalized = value.replace(/\\/g, "/");
  const parts = normalized.split("/").filter(Boolean);
  if (parts.length <= 1) {
    return normalized;
  }

  return parts.slice(0, -1).join("/");
}

function joinPath(folder: string, fileName: string) {
  const normalizedFolder = folder.replace(/\\/g, "/").replace(/\/$/, "");
  return `${normalizedFolder}/${fileName}`;
}

function OrganizeDetails({
  entry,
  isShowAllScores,
  onToggleScores,
  selectedScoreCategory,
  onRequestEditMovedTo,
  onUseScoreFolder,
}: {
  entry: Extract<HistoryEntry, { type: "organize" }>;
  isShowAllScores: boolean;
  onToggleScores: () => void;
  selectedScoreCategory?: string;
  onRequestEditMovedTo: (entryId: string) => void;
  onUseScoreFolder: (entryId: string, categoryName: string) => void;
}) {
  const visibleScores = isShowAllScores ? entry.scores : entry.scores.slice(0, 3);
  const isRenamed = entry.oldName !== entry.newName;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-border/60 bg-muted/20 p-3 text-sm">
          <p className="mb-1 text-xs text-muted-foreground">From</p>
          <p className="truncate font-medium" title={entry.fromPath}>{entry.fromPath}</p>
        </div>
        <div className="rounded-xl border border-border/60 bg-muted/20 p-3 text-sm">
          <div className="mb-1 flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Moved To</p>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={() => onRequestEditMovedTo(entry.id)}
            >
              <Pencil className="mr-1 h-3.5 w-3.5" />
              Edit
            </Button>
          </div>
          <p className="truncate font-medium" title={entry.toPath}>{entry.toPath}</p>
        </div>
      </div>

      <div className="rounded-xl border border-border/60 bg-muted/20 p-3 text-sm">
        <p className="mb-1 text-xs text-muted-foreground">Rename</p>
        <p className="font-medium">
          {isRenamed ? (
            <>
              <span className="font-normal text-foreground/70">{entry.oldName}</span>
              <span className="px-1.5 text-foreground/50">→</span>
              <span className="font-semibold text-foreground">{entry.newName}</span>
            </>
          ) : (
            "No rename"
          )}
        </p>
      </div>

      <div className="rounded-xl border border-border/60 bg-background p-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-medium">Category Scores</p>
          {entry.scores.length > 3 && (
            <Button variant="ghost" size="sm" onClick={onToggleScores}>
              {isShowAllScores ? "Show less" : "View more"}
            </Button>
          )}
        </div>

        <p className="mb-3 text-xs text-muted-foreground">Select a score to change destination folder.</p>

        <div className="space-y-3">
          {visibleScores.map((score) => (
            <button
              key={score.name}
              type="button"
              onClick={() => onUseScoreFolder(entry.id, score.name)}
              className={cn(
                "w-full space-y-1 rounded-lg border border-transparent p-2 text-left transition-colors hover:border-border hover:bg-muted/30",
                selectedScoreCategory === score.name && "border-primary/40 bg-primary/5",
              )}
            >
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium">{score.name}</span>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">{Math.round(score.score * 100)}%</span>
                  <span className="text-[11px] text-muted-foreground">
                    {selectedScoreCategory === score.name ? "Selected" : "Use folder"}
                  </span>
                </div>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary" style={{ width: `${score.score * 100}%` }} />
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function SummaryDetails({
  entry,
  onOpenSummary,
}: {
  entry: Extract<HistoryEntry, { type: "summary" }>;
  onOpenSummary: (path: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border/60 bg-muted/20 p-3 text-sm">
        <p className="text-xs text-muted-foreground">Files</p>
        <ul className="mt-2 space-y-1">
          {entry.fileNames.map((fileName) => (
            <li key={fileName} className="truncate">• {fileName}</li>
          ))}
        </ul>
      </div>
      <div className="flex items-center justify-between rounded-xl border border-border/60 bg-background p-3">
        <p className="text-sm text-muted-foreground">Summary file: {entry.summaryPath}</p>
        <Button size="sm" onClick={() => onOpenSummary(entry.summaryPath)}>
          Open Summary File
        </Button>
      </div>
    </div>
  );
}

function CalendarDetails({
  entry,
}: {
  entry: Extract<HistoryEntry, { type: "calendar" }>;
}) {
  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-border/60 bg-muted/20 p-3 text-sm">
          <p className="text-xs text-muted-foreground">Source File</p>
          <p className="font-medium">{entry.sourceFileName}</p>
        </div>
        <div className="rounded-xl border border-border/60 bg-muted/20 p-3 text-sm">
          <p className="text-xs text-muted-foreground">Meeting Title</p>
          <p className="font-medium">{entry.meetingTitle}</p>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-border/60 bg-muted/20 p-3 text-sm">
          <p className="text-xs text-muted-foreground">Meeting Time</p>
          <p className="font-medium">{entry.meetingTime}</p>
        </div>
        <div className="rounded-xl border border-border/60 bg-muted/20 p-3 text-sm">
          <p className="text-xs text-muted-foreground">Meeting Location</p>
          <p className="font-medium">{entry.meetingLocation}</p>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-border/60 bg-muted/20 p-3 text-sm">
          <p className="text-xs text-muted-foreground">Found in File</p>
          <p className="font-medium">{entry.foundInFile ? "Yes" : "No"}</p>
        </div>
        <div className="rounded-xl border border-border/60 bg-muted/20 p-3 text-sm">
          <p className="text-xs text-muted-foreground">Action</p>
          <p className="font-medium">{entry.actionLabel}</p>
        </div>
      </div>

      <div className="rounded-xl border border-border/60 bg-background p-3 text-sm">
        <p className="text-xs text-muted-foreground">Details</p>
        <p className="font-medium">{entry.details}</p>
      </div>
    </div>
  );
}

export function HistoryPage() {
  const [historyEntries, setHistoryEntries] = useState<HistoryEntry[]>(mockHistoryEntries);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | HistoryEntryType>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [scoreExpandedIds, setScoreExpandedIds] = useState<string[]>([]);
  const [selectedScoreByEntryId, setSelectedScoreByEntryId] = useState<Record<string, string>>({});
  const [openedSummaryPath, setOpenedSummaryPath] = useState<string | null>(null);

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
      if (!target || target.toPath === nextToPath) {
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
    if (!target) {
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
    if (!target) {
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
      <div className="flex items-center justify-end">
        <Card className="flex items-center gap-3 px-4 py-2 shadow-none">
          <History className="h-4 w-4 text-primary" />
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Total Actions</p>
            <p className="text-lg font-semibold">{historyEntries.length}</p>
          </div>
        </Card>
      </div>

      <Card className="border-0 bg-muted/40 shadow-none">
        <CardContent className="space-y-4 p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by title or detail..."
              className="bg-background pl-9"
            />
          </div>
          <div className="flex flex-wrap gap-2">
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
        {filteredRows.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center text-sm text-muted-foreground">
              No history rows found.
            </CardContent>
          </Card>
        ) : (
          filteredRows.map((entry) => {
            const isExpanded = expandedId === entry.id;
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
              <Card key={entry.id} className={cn("overflow-hidden transition-colors", isExpanded && "bg-muted/20")}>
                <button
                  type="button"
                  onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                  className="w-full text-left"
                >
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
                      <OrganizeDetails
                        entry={entry}
                        isShowAllScores={scoreExpandedIds.includes(entry.id)}
                        onToggleScores={() => toggleScoreExpansion(entry.id)}
                        selectedScoreCategory={selectedScoreByEntryId[entry.id]}
                        onRequestEditMovedTo={handleRequestEditMovedTo}
                        onUseScoreFolder={handleUseScoreFolder}
                      />
                    )}

                    {entry.type === "summary" && (
                      <SummaryDetails entry={entry} onOpenSummary={(path) => setOpenedSummaryPath(path)} />
                    )}

                    {entry.type === "calendar" && <CalendarDetails entry={entry} />}
                  </CardContent>
                )}
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
