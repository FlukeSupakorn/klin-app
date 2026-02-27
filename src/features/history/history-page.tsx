import { useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Clock,
  FileText,
  FolderSync,
  History,
  Search,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
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

function OrganizeDetails({
  entry,
  isShowAllScores,
  onToggleScores,
}: {
  entry: Extract<HistoryEntry, { type: "organize" }>;
  isShowAllScores: boolean;
  onToggleScores: () => void;
}) {
  const visibleScores = isShowAllScores ? entry.scores : entry.scores.slice(0, 3);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-border/60 bg-muted/20 p-3 text-sm">
          <p className="text-xs text-muted-foreground">From</p>
          <p className="truncate font-medium" title={entry.fromPath}>{entry.fromPath}</p>
        </div>
        <div className="rounded-xl border border-border/60 bg-muted/20 p-3 text-sm">
          <p className="text-xs text-muted-foreground">Moved To</p>
          <p className="truncate font-medium" title={entry.toPath}>{entry.toPath}</p>
        </div>
      </div>

      <div className="rounded-xl border border-border/60 bg-muted/20 p-3 text-sm">
        <p className="text-xs text-muted-foreground">Rename</p>
        <p className="font-medium">{entry.oldName} → {entry.newName}</p>
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
        <div className="space-y-3">
          {visibleScores.map((score) => (
            <div key={score.name} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium">{score.name}</span>
                <span className="text-muted-foreground">{Math.round(score.score * 100)}%</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary" style={{ width: `${score.score * 100}%` }} />
              </div>
            </div>
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
  );
}

export function HistoryPage() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | HistoryEntryType>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [scoreExpandedIds, setScoreExpandedIds] = useState<string[]>([]);
  const [openedSummaryPath, setOpenedSummaryPath] = useState<string | null>(null);

  const filteredRows = useMemo(() => {
    return mockHistoryEntries.filter((entry) => {
      const byType = typeFilter === "all" || entry.type === typeFilter;
      const bySearch =
        search.length === 0 ||
        entry.title.toLowerCase().includes(search.toLowerCase()) ||
        entry.subtitle.toLowerCase().includes(search.toLowerCase());
      return byType && bySearch;
    });
  }, [search, typeFilter]);

  const toggleScoreExpansion = (id: string) => {
    setScoreExpandedIds((state) =>
      state.includes(id) ? state.filter((itemId) => itemId !== id) : [...state, id],
    );
  };

  return (
    <div className="space-y-6 pb-10">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-4xl font-semibold tracking-tight">History</h2>
          <p className="text-muted-foreground">Mock timeline for organize, summary, and calendar actions.</p>
        </div>
        <Card className="flex items-center gap-3 px-4 py-2 shadow-none">
          <History className="h-4 w-4 text-primary" />
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Total Actions</p>
            <p className="text-lg font-semibold">{mockHistoryEntries.length}</p>
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
                          <CardTitle className="truncate text-lg" title={entry.title}>{entry.title}</CardTitle>
                          <p className="truncate text-sm text-muted-foreground" title={entry.subtitle}>{entry.subtitle}</p>
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
