import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { OrganizeFilesPanel } from "@/features/dashboard/organize-files-panel";
import type { HistoryEntry } from "@/types/history";
import { historyApiService } from "@/services/history-api-service";
import { useSemanticSearchStore } from "@/stores/use-semantic-search-store";
import { SearchProgress } from "@/features/dashboard/search-progress";
import { tauriClient } from "@/services/tauri-client";
import { normalizeOsPath } from "@/lib/path-utils";
import { formatBytes } from "@/lib/utils";
import { useCategoryManagementStore } from "@/stores/use-category-management-store";
import type { FolderStatsTick, FolderStatsUpdated } from "@/types/ipc";
import { listen } from "@tauri-apps/api/event";
import {
  Eye,
  FileText,
  Folder,
  FolderTree,
  History,
  ShieldCheck,
  SlidersHorizontal,
  Zap,
} from "lucide-react";
import { SearchInput } from "@/components/ui/search-input";
import { getCategoryIcon, withAlpha } from "@/features/categories/category-appearance";
import { logger } from "@/lib/logger";
import { NotificationBellButton } from "@/features/calendar-notifications/notification-bell-button";
import { NotificationPanel } from "@/features/calendar-notifications/notification-panel";
import { EventDetailModal } from "@/features/calendar-notifications/event-detail-modal";
import { useCalendarNotificationsStore } from "@/stores/use-calendar-notifications-store";

const ENTRY_TYPE_BG: Record<string, string> = {
  organize: "var(--primary)",
  calendar: "var(--secondary)",
};
const ENTRY_TYPE_FG: Record<string, string> = {
  organize: "var(--primary-foreground)",
  calendar: "var(--secondary-foreground)",
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

  // Semantic search — state lives in a global store so the request keeps
  // running and is reachable from anywhere in the app even if the dropdown
  // is closed (see GlobalSemanticSearchBubble).
  const searchQuery = useSemanticSearchStore((s) => s.query);
  const setSearchQuery = useSemanticSearchStore((s) => s.setQuery);
  const searchResults = useSemanticSearchStore((s) => s.results);
  const searchLoading = useSemanticSearchStore((s) => s.loading);
  const searchStartedAt = useSemanticSearchStore((s) => s.startedAt);
  const searchError = useSemanticSearchStore((s) => s.error);
  const searchSubmitted = useSemanticSearchStore((s) => s.submitted);
  const showDrop = useSemanticSearchStore((s) => s.isDropdownOpen);
  const semanticStatus = useSemanticSearchStore((s) => s.semanticStatus);
  const semanticErrorMsg = useSemanticSearchStore((s) => s.semanticError);
  const indexingPendingCount = useSemanticSearchStore((s) => s.indexingPendingCount);
  const submitSearchAction = useSemanticSearchStore((s) => s.submit);
  const cancelSearch = useSemanticSearchStore((s) => s.cancel);
  const resetSearch = useSemanticSearchStore((s) => s.reset);
  const openDropdown = useSemanticSearchStore((s) => s.openDropdown);
  const closeDropdown = useSemanticSearchStore((s) => s.closeDropdown);
  const acknowledgeSearch = useSemanticSearchStore((s) => s.acknowledge);

  const [catStats, setCatStats] = useState<Record<string, { count: number; bytes: number; scanning: boolean }>>({});
  const [catPage, setCatPage] = useState(0);
  const [hoverLeft, setHoverLeft] = useState(false);
  const [hoverRight, setHoverRight] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  const isNotificationPanelOpen = useCalendarNotificationsStore((s) => s.isPanelOpen);
  const toggleNotificationPanel = useCalendarNotificationsStore((s) => s.togglePanel);
  const closeNotificationPanel = useCalendarNotificationsStore((s) => s.closePanel);
  const refreshNotifications = useCalendarNotificationsStore((s) => s.refresh);

  const categories = useCategoryManagementStore((state) => state.categories);
  const categoriesRef = useRef(categories);
  categoriesRef.current = categories;

  const enabledCats = useMemo(
    () => categories.filter((c) => c.enabled && c.folderPath.trim().length > 0),
    [categories],
  );

  const loadCatStats = useCallback(async () => {
    const enabled = categoriesRef.current.filter((c) => c.enabled && c.folderPath.trim().length > 0);
    if (enabled.length === 0) return;

    // Phase 1: instant cached lookup
    const cachedResults = await Promise.all(
      enabled.map(async (cat) => {
        const cached = await tauriClient.getFolderStatsCached(cat.folderPath).catch(() => null);
        return [cat, cached] as const;
      }),
    );

    setCatStats((prev) => {
      const next = { ...prev };
      for (const [cat, cached] of cachedResults) {
        if (cached) {
          next[cat.id] = { count: cached.fileCount, bytes: cached.totalBytes, scanning: false };
        } else if (next[cat.id] == null) {
          next[cat.id] = { count: 0, bytes: 0, scanning: true };
        }
      }
      return next;
    });

    // Phase 2: trigger streaming scans for cache misses
    cachedResults
      .filter(([, cached]) => !cached)
      .forEach(([cat]) => {
        void tauriClient.startFolderStatsScan(cat.folderPath).catch(() => undefined);
      });
  }, []);

  // Map folderPath -> categoryId for resolving Tauri events
  const folderToCatRef = useRef<Map<string, string>>(new Map());
  useEffect(() => {
    const map = new Map<string, string>();
    for (const c of categories) {
      if (c.folderPath) map.set(c.folderPath, c.id);
    }
    folderToCatRef.current = map;
  }, [categories]);

  // Subscribe once to streaming + live update events
  useEffect(() => {
    let unlistenProgress: (() => void) | null = null;
    let unlistenUpdated: (() => void) | null = null;
    void (async () => {
      unlistenProgress = await listen<FolderStatsTick>("folder-stats-progress", (event) => {
        const { folderPath, fileCount, totalBytes, done } = event.payload;
        const catId = folderToCatRef.current.get(folderPath);
        if (!catId) return;
        setCatStats((prev) => ({
          ...prev,
          [catId]: { count: fileCount, bytes: totalBytes, scanning: !done },
        }));
      });
      unlistenUpdated = await listen<FolderStatsUpdated>("folder-stats-updated", (event) => {
        const { folderPath, fileCount, totalBytes } = event.payload;
        const catId = folderToCatRef.current.get(folderPath);
        if (!catId) return;
        setCatStats((prev) => ({
          ...prev,
          [catId]: { count: fileCount, bytes: totalBytes, scanning: false },
        }));
      });
    })();
    return () => {
      unlistenProgress?.();
      unlistenUpdated?.();
    };
  }, []);

  const sortedCats = useMemo(
    () => [...enabledCats].sort((a, b) => (catStats[b.id]?.count ?? -1) - (catStats[a.id]?.count ?? -1)),
    [enabledCats, catStats],
  );

  const displayCats = useMemo(
    () => sortedCats.slice(catPage * 3, catPage * 3 + 3),
    [sortedCats, catPage],
  );

  const hasNextPage = (catPage + 1) * 3 < sortedCats.length;
  const hasPrevPage = catPage > 0;

  const loadRecentHistory = useCallback(async () => {
    try {
      const firstPage = await historyApiService.list({ limit: 20, offset: 0 });
      const rows = firstPage.entries
        .sort((l, r) => new Date(r.timestamp).getTime() - new Date(l.timestamp).getTime())
        .slice(0, 5);
      setRecentHistoryEntries(rows);
    } catch (e) {
      logger.warn("[dashboard] failed to load recent history", e);
      setRecentHistoryEntries([]);
    }
  }, []);

  useEffect(() => {
    void loadRecentHistory();
    void loadCatStats();
    const onHistoryUpdated = () => {
      void loadRecentHistory();
      void loadCatStats();
      void refreshNotifications();
    };
    window.addEventListener("klin:history-updated", onHistoryUpdated);
    return () => { window.removeEventListener("klin:history-updated", onHistoryUpdated); };
  }, [loadRecentHistory, loadCatStats, refreshNotifications]);

  // Close search dropdown on click outside. The request itself keeps
  // running in the store — the floating bubble lets the user reopen it.
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        closeDropdown();
        acknowledgeSearch();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => { document.removeEventListener("mousedown", handler); };
  }, [closeDropdown, acknowledgeSearch]);

  useEffect(() => {
    if (!searchQuery) { closeDropdown(); return; }
    openDropdown();
  }, [searchQuery, openDropdown, closeDropdown]);

  const onSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") { e.preventDefault(); void submitSearchAction(searchQuery); }
    if (e.key === "Escape") {
      if (searchLoading) {
        cancelSearch();
        closeDropdown();
      } else {
        resetSearch();
      }
    }
  };

  const handleOpenRecentHistoryEntry = (entryId: string) => {
    navigate("/history", { state: { expandedEntryId: entryId } });
  };

  return (
    <div className="flex h-full flex-col gap-5 overflow-hidden">
      <EventDetailModal />
      {/* Header: greeting + semantic search */}
      <div className="flex shrink-0 items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-medium text-muted-foreground">{getHourGreeting()}</div>
          <h1 className="mt-0.5 text-[21px] font-extrabold tracking-tight text-foreground" style={{ letterSpacing: "-0.4px" }}>
            Your File Intelligence Hub
          </h1>
        </div>

        {/* Calendar notification bell */}
        <div className="relative shrink-0">
          <NotificationBellButton onClick={toggleNotificationPanel} open={isNotificationPanelOpen} />
          <NotificationPanel open={isNotificationPanelOpen} onClose={closeNotificationPanel} />
        </div>

        {/* Semantic search */}
        <div ref={searchRef} className="relative w-[240px] shrink-0">
          <SearchInput
            value={searchQuery}
            onChange={setSearchQuery}
            onKeyDown={onSearchKeyDown}
            onClear={() => { resetSearch(); }}
            onFocus={() => { if (searchSubmitted || searchQuery) openDropdown(); }}
            placeholder="Semantic search..."
            focused={showDrop}
          />

          {/* Search results dropdown */}
          {showDrop && (searchSubmitted || searchLoading || searchError) && (
            <div className="klin-slide-up absolute right-0 top-[calc(100%+8px)] z-50 w-[400px] overflow-hidden rounded-[16px] border border-border bg-card"
              style={{ boxShadow: "0 12px 40px var(--primary-border)" }}>
              <div className="flex items-center gap-1.5 border-b border-border px-3.5 py-2.5"
                style={{ background: "var(--muted)" }}>
                <Zap className="h-3 w-3 text-primary" />
                <span className="text-[10.5px] font-extrabold uppercase tracking-widest text-primary">Semantic Search</span>
                {!searchLoading && semanticStatus !== "ready" && (
                  <span
                    className="ml-2 rounded-full px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wider"
                    title={semanticErrorMsg ?? undefined}
                    style={{
                      background: semanticStatus === "pending"
                        ? "var(--muted)"
                        : "color-mix(in srgb, var(--warning) 18%, transparent)",
                      color: semanticStatus === "pending" ? "var(--muted-foreground)" : "var(--warning)",
                    }}
                  >
                    {semanticStatus === "pending"
                      ? `Indexing ${indexingPendingCount}…`
                      : semanticStatus === "degraded"
                        ? "Filename only"
                        : "Index not ready"}
                  </span>
                )}
                <span className="ml-auto text-[10.5px] text-muted-foreground">
                  {searchLoading ? "Working…" : `${searchResults.length} results`}
                </span>
              </div>
              <div className="max-h-72 overflow-y-auto">
                {searchLoading ? (
                  <SearchProgress startedAt={searchStartedAt} />
                ) : searchError ? (
                  <div className="m-2 rounded-[10px] border border-destructive/20 bg-destructive/10 px-3 py-2 text-[12px] text-destructive">{searchError}</div>
                ) : searchResults.length === 0 ? (
                  <div className="py-6 text-center text-[13px] text-muted-foreground">
                    {semanticStatus === "ready"
                      ? <>No files found for &ldquo;{searchQuery.trim()}&rdquo;</>
                      : <>No filename matches yet — semantic results will appear once indexing finishes.</>}
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
            </div>
          )}
        </div>
      </div>

      {/* Category stat cards */}
      {enabledCats.length > 0 && (
        <div className="relative shrink-0">
          {/* Cards grid */}
          <div
            className="grid gap-3.5"
            style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}
          >
            <div
              className="grid gap-3.5 transition-[margin] duration-200"
              style={{
                gridColumn: "span 3",
                gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                marginLeft: hoverLeft && hasPrevPage ? 44 : 0,
                marginRight: hoverRight && hasNextPage ? 44 : 0,
              }}
            >
              {displayCats.map((cat) => {
              const CatIcon = getCategoryIcon(cat.icon);
              const stats = catStats[cat.id];
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
                  <div className="text-[28px] font-extrabold leading-none text-foreground tabular-nums" style={{ letterSpacing: "-1.5px" }}>
                    {stats ? stats.count : "—"}
                  </div>
                  <div className="mt-0.5 text-[10px] font-semibold text-muted-foreground">files</div>
                  {/* Folder size */}
                  {stats?.scanning ? (
                    <div className="mt-0.5 flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground/70">
                      <span className="tabular-nums">{formatBytes(stats.bytes)}</span>
                      <span className="inline-block h-1 w-1 rounded-full bg-current animate-pulse" />
                    </div>
                  ) : (
                    <div className="mt-0.5 text-[10px] font-semibold text-muted-foreground/70 tabular-nums">
                      {stats ? formatBytes(stats.bytes) : "—"}
                    </div>
                  )}
                  {/* Name */}
                  <div className="mt-3 truncate text-[13px] font-bold" style={{ color: cat.color }}>
                    {cat.name}
                  </div>
                </div>
              );
              })}
            </div>

            {/* Shortcuts panel */}
            <div
              className="flex flex-col overflow-hidden rounded-[18px] p-3.5"
              style={{
                background: "var(--card)",
                border: "1.5px solid var(--border)",
                boxShadow: "var(--shadow-xs)",
              }}
            >
              <div className="mb-2.5 flex items-center justify-between">
                <span className="text-[9.5px] font-extrabold uppercase tracking-widest text-muted-foreground">
                  Shortcuts
                </span>
                <Zap className="h-3.5 w-3.5" style={{ color: "var(--primary)" }} />
              </div>
              <div className="grid flex-1 grid-cols-2 gap-2">
                {[
                  { Icon: FolderTree, label: "Categories", tab: "config" as const },
                  { Icon: Eye, label: "Auto organize", tab: "automation" as const },
                  { Icon: ShieldCheck, label: "Security", tab: "security" as const },
                  { Icon: SlidersHorizontal, label: "All settings", tab: null },
                ].map((s) => (
                  <button
                    key={s.label}
                    type="button"
                    onClick={() => navigate("/settings", s.tab ? { state: { tab: s.tab } } : undefined)}
                    className="group flex flex-col items-start justify-center gap-1.5 rounded-[12px] border border-border bg-muted/40 p-2.5 text-left transition-colors hover:bg-primary/10 hover:border-primary/30"
                  >
                    <s.Icon className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-primary" />
                    <span className="text-[12px] font-bold text-foreground">{s.label}</span>
                  </button>
                ))}
              </div>
            </div>
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

          {/* Hover zone + next arrow — sits between the last category card and the Shortcuts panel */}
          {hasNextPage && (
            <div
              className="absolute inset-y-0 z-10 transition-[right] duration-200" 
              style={{ right: "calc(25% - 4px)", width: 48 }} 
              onMouseEnter={() => setHoverRight(true)}
              onMouseLeave={() => setHoverRight(false)}
            >
              <button
                onClick={() => setCatPage((p) => p + 1)}
                className="absolute left-1/2 top-1/2 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-[12px] transition-all duration-200"
                style={{
                  opacity: hoverRight ? 1 : 0,
                  pointerEvents: hoverRight ? "auto" : "none",
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
