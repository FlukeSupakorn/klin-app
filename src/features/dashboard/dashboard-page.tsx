import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { OrganizeFilesPanel } from "@/features/dashboard/organize-files-panel";
import type { HistoryEntry } from "@/types/history";
import { historyApiService } from "@/services/history-api-service";
import { fileSearchApiService } from "@/services/file-search-api-service";
import { tauriClient } from "@/services/tauri-client";
import { normalizeOsPath } from "@/lib/path-utils";
import { useCategoryManagementStore } from "@/stores/use-category-management-store";
import type { FileSearchResultItem } from "@/types/domain";
import {
  Folder, FileText, History, Search, X, Zap,
} from "lucide-react";
import { getCategoryIcon, withAlpha } from "@/features/categories/category-appearance";

const ENTRY_TYPE_BG: Record<string, string> = {
  organize: "var(--primary)",
  summary: "var(--purple)",
  calendar: "var(--success)",
};
const ENTRY_TYPE_FG: Record<string, string> = {
  organize: "var(--primary-foreground)",
  summary: "#fff",
  calendar: "#fff",
};

const searchResultGrads = [
  "var(--primary)",
  "var(--success)",
  "var(--warning)",
  "var(--purple)",
];

function getHourGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning ☀️";
  if (h < 18) return "Good afternoon ☀️";
  return "Good evening 🌙";
}

function confColor(c: number): string {
  return c >= 80 ? "var(--success)" : c >= 65 ? "var(--warning)" : "var(--destructive)";
}

export function DashboardPage() {
  const navigate = useNavigate();
  const [recentHistoryEntries, setRecentHistoryEntries] = useState<HistoryEntry[]>([]);

  // Semantic search
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<FileSearchResultItem[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchSubmitted, setSearchSubmitted] = useState(false);
  const [showDrop, setShowDrop] = useState(false);
  const [catFileCounts, setCatFileCounts] = useState<Record<string, number>>({});
  const [catPage, setCatPage] = useState(0);
  const [hoverLeft, setHoverLeft] = useState(false);
  const [hoverRight, setHoverRight] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  const categories = useCategoryManagementStore((state) => state.categories);
  const categoriesRef = useRef(categories);
  categoriesRef.current = categories;

  const enabledCats = useMemo(
    () => categories.filter((c) => c.enabled && c.folderPath.trim().length > 0),
    [categories],
  );

  const loadCatCounts = useCallback(async () => {
    const enabled = categoriesRef.current.filter((c) => c.enabled && c.folderPath.trim().length > 0);
    if (enabled.length === 0) return;
    const results = await Promise.all(
      enabled.map(async (cat) => {
        const files = await tauriClient.readFolder({ folderPath: cat.folderPath }).catch(() => [] as string[]);
        return [cat.id, files.length] as const;
      }),
    );
    setCatFileCounts(Object.fromEntries(results));
  }, []);

  const sortedCats = useMemo(
    () => [...enabledCats].sort((a, b) => (catFileCounts[b.id] ?? -1) - (catFileCounts[a.id] ?? -1)),
    [enabledCats, catFileCounts],
  );

  const displayCats = useMemo(
    () => sortedCats.slice(catPage * 4, catPage * 4 + 4),
    [sortedCats, catPage],
  );

  const hasNextPage = (catPage + 1) * 4 < sortedCats.length;
  const hasPrevPage = catPage > 0;

  const loadRecentHistory = useCallback(async () => {
    try {
      const firstPage = await historyApiService.list({ limit: 20, offset: 0 });
      const rows = firstPage.entries
        .sort((l, r) => new Date(r.timestamp).getTime() - new Date(l.timestamp).getTime())
        .slice(0, 5);
      setRecentHistoryEntries(rows);
    } catch {
      setRecentHistoryEntries([]);
    }
  }, []);

  useEffect(() => {
    void loadRecentHistory();
    void loadCatCounts();
    const onHistoryUpdated = () => { void loadRecentHistory(); void loadCatCounts(); };
    window.addEventListener("klin:history-updated", onHistoryUpdated);
    return () => { window.removeEventListener("klin:history-updated", onHistoryUpdated); };
  }, [loadRecentHistory, loadCatCounts]);

  // Close search dropdown on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node))
        setShowDrop(false);
    };
    document.addEventListener("mousedown", handler);
    return () => { document.removeEventListener("mousedown", handler); };
  }, []);

  useEffect(() => {
    if (!searchQuery) { setShowDrop(false); return; }
    setShowDrop(true);
  }, [searchQuery]);

  const submitSearch = async (q: string) => {
    if (!q.trim()) { setSearchResults([]); setSearchError(null); return; }
    setSearchLoading(true);
    setSearchError(null);
    setSearchSubmitted(true);
    try {
      const results = await fileSearchApiService.search(q.trim());
      setSearchResults(results);
    } catch (error) {
      setSearchResults([]);
      setSearchError(error instanceof Error ? error.message : "Search failed");
    } finally { setSearchLoading(false); }
  };

  const onSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") { e.preventDefault(); void submitSearch(searchQuery); }
    if (e.key === "Escape") { setShowDrop(false); setSearchQuery(""); }
  };

  const handleOpenRecentHistoryEntry = (entryId: string) => {
    navigate("/history", { state: { expandedEntryId: entryId } });
  };

  return (
    <div className="flex h-full flex-col gap-5 overflow-hidden">
      {/* Header: greeting + semantic search */}
      <div className="flex shrink-0 items-center gap-3">
        <div className="flex-1">
          <div className="text-[13px] font-medium text-muted-foreground">{getHourGreeting()}</div>
          <h1 className="mt-0.5 text-[21px] font-extrabold tracking-tight text-foreground" style={{ letterSpacing: "-0.4px" }}>
            Your File Intelligence Hub
          </h1>
        </div>

        {/* Semantic search */}
        <div ref={searchRef} className="relative w-[240px]">
          <div
            className="flex items-center gap-2 rounded-[12px] border bg-card px-3 transition-all"
            style={{
              borderColor: showDrop ? "var(--primary)" : "var(--border)",
              boxShadow: showDrop ? "0 0 0 3px var(--primary-soft)" : "var(--shadow-xs)",
            }}
          >
            <Search className="h-3.5 w-3.5 shrink-0 transition-colors" style={{ color: showDrop ? "var(--primary)" : "var(--muted-foreground)" }} />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={onSearchKeyDown}
              placeholder="Semantic search..."
              className="h-9 flex-1 bg-transparent text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
            {searchQuery && (
              <button
                onClick={() => { setSearchQuery(""); setSearchResults([]); setShowDrop(false); setSearchSubmitted(false); }}
                className="flex h-4 w-4 items-center justify-center rounded-full bg-border"
              >
                <X className="h-2.5 w-2.5 text-muted-foreground" />
              </button>
            )}
          </div>

          {/* Search results dropdown */}
          {showDrop && (searchSubmitted || searchLoading || searchError) && (
            <div className="klin-slide-up absolute left-0 top-[calc(100%+8px)] z-50 w-[400px] overflow-hidden rounded-[16px] border border-border bg-card"
              style={{ boxShadow: "0 12px 40px var(--primary-border)" }}>
              <div className="flex items-center gap-1.5 border-b border-border px-3.5 py-2.5"
                style={{ background: "var(--muted)" }}>
                <Zap className="h-3 w-3 text-primary" />
                <span className="text-[10.5px] font-extrabold uppercase tracking-widest text-primary">Semantic Search</span>
                <span className="ml-auto text-[10.5px] text-muted-foreground">{searchResults.length} results</span>
              </div>
              <div className="max-h-72 overflow-y-auto">
                {searchLoading ? (
                  <div className="py-6 text-center text-[13px] text-muted-foreground">Searching...</div>
                ) : searchError ? (
                  <div className="m-2 rounded-[10px] border border-destructive/20 bg-destructive/10 px-3 py-2 text-[12px] text-destructive">{searchError}</div>
                ) : searchResults.length === 0 ? (
                  <div className="py-6 text-center text-[13px] text-muted-foreground">
                    No files found for &ldquo;{searchQuery.trim()}&rdquo;
                  </div>
                ) : (
                  searchResults.map((item, i) => (
                    <div key={item.id}
                      className="flex cursor-pointer items-center gap-3 border-t border-border px-3.5 py-2.5 transition-colors hover:bg-muted/60">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px]"
                        style={{ background: searchResultGrads[i % searchResultGrads.length] }}>
                        <FileText className="h-3.5 w-3.5 text-white" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13px] font-bold text-foreground">{item.fileName}</div>
                        <div className="truncate text-[10.5px] text-muted-foreground" style={{ fontFamily: "'JetBrains Mono',monospace" }}>
                          {item.folder}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="text-[11px] font-bold text-muted-foreground">{item.fileType || "file"}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="border-t border-border py-2 text-center text-[11px] text-muted-foreground">
                Powered by semantic AI search across your KlinFiles
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Category stat cards */}
      {enabledCats.length > 0 && (
        <div className="relative shrink-0">
          {/* Cards grid — shifts inward only when hovering the edge zones */}
          <div
            className="grid gap-3.5 transition-[margin] duration-200"
            style={{
              gridTemplateColumns: `repeat(${Math.min(displayCats.length, 4)}, 1fr)`,
              marginLeft: hoverLeft && hasPrevPage ? 44 : 0,
              marginRight: hoverRight && hasNextPage ? 44 : 0,
            }}
          >
            {displayCats.map((cat) => {
              const CatIcon = getCategoryIcon(cat.icon);
              return (
                <div
                  key={cat.id}
                  className="group relative cursor-pointer overflow-hidden rounded-[18px] py-[18px] pl-[calc(5%+16px)] pr-5 transition-colors duration-150"
                  style={{
                    background: "var(--card)",
                    border: "1.5px solid var(--border)",
                    boxShadow: "var(--shadow-xs)",
                  }}
                  onClick={() => void tauriClient.openExternalUrl(normalizeOsPath(cat.folderPath))}
                >
                  <div
                    className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-150 group-hover:opacity-100"
                    style={{ background: withAlpha(cat.color, "12"), borderRadius: "inherit" }}
                  />
                  <div
                    className="absolute inset-y-0 left-0 w-[5%] rounded-l-[16px]"
                    style={{ background: cat.color }}
                  />
                  <div
                    className="mb-3 flex h-[36px] w-[36px] items-center justify-center rounded-[11px]"
                    style={{
                      background: withAlpha(cat.color, "18"),
                      border: `1px solid ${withAlpha(cat.color, "30")}`,
                    }}
                  >
                    <CatIcon className="h-4 w-4" style={{ color: cat.color }} />
                  </div>
                  {/* File count */}
                  <div className="text-[28px] font-extrabold leading-none text-foreground" style={{ letterSpacing: "-1.5px" }}>
                    {catFileCounts[cat.id] ?? "—"}
                  </div>
                  <div className="mt-0.5 text-[10px] font-semibold text-muted-foreground">files</div>
                  {/* Name */}
                  <div className="mt-3 truncate text-[13px] font-bold" style={{ color: cat.color }}>
                    {cat.name}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Left edge hover zone + prev arrow */}
          {hasPrevPage && (
            <div
              className="absolute inset-y-0 left-0 w-10 z-10"
              onMouseEnter={() => setHoverLeft(true)}
              onMouseLeave={() => setHoverLeft(false)}
            >
              <button
                onClick={() => setCatPage((p) => p - 1)}
                className="absolute left-0 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-[12px] transition-all duration-200"
                style={{
                  opacity: hoverLeft ? 1 : 0,
                  background: "var(--card)",
                  border: "1.5px solid var(--border)",
                  boxShadow: "var(--shadow-xs)",
                  color: "var(--foreground)",
                }}
              >
                <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
            </div>
          )}

          {/* Right edge hover zone + next arrow */}
          {hasNextPage && (
            <div
              className="absolute inset-y-0 right-0 w-10 z-10"
              onMouseEnter={() => setHoverRight(true)}
              onMouseLeave={() => setHoverRight(false)}
            >
              <button
                onClick={() => setCatPage((p) => p + 1)}
                className="absolute right-0 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-[12px] transition-all duration-200"
                style={{
                  opacity: hoverRight ? 1 : 0,
                  background: "var(--card)",
                  border: "1.5px solid var(--border)",
                  boxShadow: "var(--shadow-xs)",
                  color: "var(--foreground)",
                }}
              >
                <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Main grid: AI Organizer (left) + Live Activity (right) */}
      <div className="grid min-h-0 flex-1 grid-cols-[1fr_300px] gap-4 overflow-hidden">
        {/* Left: AI Organizer card */}
        <div
          className="flex flex-col overflow-hidden rounded-[18px] border border-border bg-card"
          style={{ boxShadow: "var(--shadow-xs)" }}
        >
          <div className="shrink-0 border-b border-border px-5 py-3.5">
            <div className="flex items-center gap-2.5">
              <div className="flex h-[30px] w-[30px] items-center justify-center rounded-[9px]"
                style={{ background: "var(--primary)" }}>
                <Zap className="h-3.5 w-3.5 text-white" />
              </div>
              <div>
                <div className="text-[13px] font-extrabold text-foreground">AI Organizer</div>
                <div className="text-[11px] text-muted-foreground">Drop files — AI categorizes automatically</div>
              </div>
              <div className="ml-auto">
                <span className="rounded-full px-2.5 py-1 text-[10px] font-bold"
                  style={{ background: "var(--primary-soft)", color: "var(--primary)" }}>
                  AI Active
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-1 flex-col overflow-hidden p-4">
            <OrganizeFilesPanel />
          </div>
        </div>

        {/* Right: Live Activity stream */}
        <div
          className="flex flex-col overflow-hidden rounded-[18px] border border-border bg-card"
          style={{ boxShadow: "var(--shadow-xs)" }}
        >
          <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3.5">
            <div>
              <div className="text-[13px] font-extrabold text-foreground">Live Activity</div>
              <div className="text-[11px] text-muted-foreground">AI movements in real time</div>
            </div>
            <div className="klin-pulse-dot h-2 w-2 rounded-full" style={{ background: "var(--success)" }} />
          </div>

          <div className="flex-1 overflow-y-auto">
            {recentHistoryEntries.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 p-6 opacity-60">
                <div className="flex h-12 w-12 items-center justify-center rounded-[14px]"
                  style={{ background: "var(--primary-tint)", border: "1.5px solid var(--primary-border)" }}>
                  <History className="h-5 w-5 text-primary" />
                </div>
                <div className="text-center">
                  <div className="text-[13.5px] font-bold text-foreground">No activity yet</div>
                  <div className="mt-0.5 text-[12px] text-muted-foreground">Organize some files to see live activity</div>
                </div>
              </div>
            ) : (
              recentHistoryEntries.map((entry, i) => {
                const iconBg = ENTRY_TYPE_BG[entry.type] ?? "var(--primary)";
                const iconFg = ENTRY_TYPE_FG[entry.type] ?? "var(--primary-foreground)";
                const name = entry.type === "organize" ? entry.oldName : entry.title;
                const cat = entry.type === "organize" ? (entry.scores[0]?.name ?? "Unknown") : entry.type;
                const conf = entry.type === "organize" ? Math.round((entry.scores[0]?.score ?? 0) * 100) : 0;
                const ago = new Date(entry.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
                return (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => handleOpenRecentHistoryEntry(entry.id)}
                    className="flex w-full items-center gap-3 border-b border-border px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-muted/40"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px]"
                      style={{ background: iconBg }}>
                      <FileText className="h-[15px] w-[15px]" style={{ color: iconFg }} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[12.5px] font-bold text-foreground">{name}</div>
                      <div className="mt-0.5 truncate text-[10.5px] text-muted-foreground">{cat}</div>
                    </div>
                    <div className="shrink-0 text-right">
                      {conf > 0 && <div className="text-[11px] font-bold" style={{ color: confColor(conf) }}>{conf}%</div>}
                      <div className="mt-0.5 text-[10px] text-muted-foreground">{ago}</div>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          <div className="shrink-0 border-t border-border p-3">
            <button
              onClick={() => navigate("/history")}
              className="w-full rounded-[10px] py-2 text-[12.5px] font-bold text-primary transition-colors hover:bg-primary/10"
              style={{ background: "var(--primary-tint)" }}
            >
              View Full History →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
