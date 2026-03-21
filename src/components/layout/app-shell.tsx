import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import {
  CalendarDays,
  FileText,
  History,
  LayoutGrid,
  Search,
  Settings,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/not-use-ui/badge";
import { bootstrapAppData } from "@/services/bootstrap-service";
import { categoryManagementService } from "@/services/category-management-service";
import { fileSearchApiService } from "@/services/file-search-api-service";
import { useAuthStore } from "@/features/auth/use-auth-store";
import { GlobalOrganizeResumeBubble } from "@/features/dashboard/organize-files-panel/global-organize-resume-bubble";
import { StartupDialogs, runStartupChecks } from "@/features/startup/startup-dialogs";
import type { FailedService } from "@/features/startup/startup-dialogs";
import { SettingsManagementDialogs } from "@/features/settings/settings-management-dialogs";
import type { FileSearchResultItem } from "@/types/domain";
import klinLogo from "@/assets/klin-logo.svg";

const navItems = [
  { to: "/", label: "Dashboard", icon: LayoutGrid },
  { to: "/history", label: "History", icon: History },
  { to: "/calendar", label: "Calendar", icon: CalendarDays },
  { to: "/notes", label: "Notes", icon: FileText },
  { to: "/settings", label: "Settings", icon: Settings },
];

export function AppShell() {
  const initializeAuth = useAuthStore((state) => state.initialize);
  const profile = useAuthStore((state) => state.profile);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<FileSearchResultItem[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [activeResultIndex, setActiveResultIndex] = useState(-1);
  const [searchSubmitted, setSearchSubmitted] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const searchPanelRef = useRef<HTMLDivElement>(null);

  const [healthIssues, setHealthIssues] = useState<FailedService[]>([]);
  const [defaultPathSet, setDefaultPathSet] = useState<{ path: string } | null>(null);
  const [showDefaultFolderSettings, setShowDefaultFolderSettings] = useState(false);

  useEffect(() => {
    void (async () => {
      void initializeAuth();
      const checks = await runStartupChecks().catch(() => ({ healthIssues: [], defaultPathSet: null }));
      setHealthIssues(checks.healthIssues);
      setDefaultPathSet(checks.defaultPathSet);
      void bootstrapAppData().catch(() => undefined);
    })();
  }, [initializeAuth]);

  useEffect(() => {
    let disposed = false;

    const syncCategoriesFromWorker = () => {
      void categoryManagementService
        .refreshCategoriesFromWorker()
        .then(() => {
          categoryManagementService.syncToAutomationStores();
        })
        .catch(() => undefined);
    };

    // Hydrate category metadata (including color) immediately on app load.
    syncCategoriesFromWorker();

    // Retry a few times because worker API can come up slightly after UI mounts.
    const retryTimers = [1000, 3000, 7000].map((delay) => window.setTimeout(() => {
      if (!disposed) {
        syncCategoriesFromWorker();
      }
    }, delay));

    const onFocus = () => {
      syncCategoriesFromWorker();
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        syncCategoriesFromWorker();
      }
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      disposed = true;
      retryTimers.forEach((id) => window.clearTimeout(id));
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  useEffect(() => {
    if (searchOpen) searchRef.current?.focus();
  }, [searchOpen]);

  useEffect(() => {
    const onClickAway = (event: MouseEvent) => {
      const target = event.target as Node;
      if (searchPanelRef.current && !searchPanelRef.current.contains(target)) {
        setActiveResultIndex(-1);
      }
    };

    document.addEventListener("mousedown", onClickAway);
    return () => {
      document.removeEventListener("mousedown", onClickAway);
    };
  }, []);

  const formatSize = (bytes: number) => {
    if (bytes < 1024) {
      return `${bytes} B`;
    }

    const kb = bytes / 1024;
    if (kb < 1024) {
      return `${kb.toFixed(1)} KB`;
    }

    const mb = kb / 1024;
    return `${mb.toFixed(1)} MB`;
  };

  const formatLastEdited = (value: string) => {
    const time = Date.parse(value);
    if (Number.isNaN(time)) {
      return "Unknown";
    }

    return new Date(time).toLocaleString();
  };

  const submitSearch = async () => {
    const query = searchQuery.trim();
    setSearchSubmitted(true);
    setActiveResultIndex(-1);

    if (!query) {
      setSearchResults([]);
      setSearchError(null);
      return;
    }

    setSearchLoading(true);
    setSearchError(null);

    try {
      const results = await fileSearchApiService.search(query);
      setSearchResults(results);
    } catch (error) {
      setSearchResults([]);
      setSearchError(error instanceof Error ? error.message : "Search failed");
    } finally {
      setSearchLoading(false);
    }
  };

  const onSearchKeyDown = async (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      await submitSearch();
      return;
    }

    if (!searchResults.length) {
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveResultIndex((prev) => (prev + 1) % searchResults.length);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveResultIndex((prev) => (prev <= 0 ? searchResults.length - 1 : prev - 1));
      return;
    }

    if (event.key === "Escape") {
      setActiveResultIndex(-1);
    }
  };

  const profileInitial = (profile?.name?.trim()?.charAt(0) || "K").toUpperCase();

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-background">
      <header className="flex h-20 shrink-0 items-center gap-4 px-8 lg:px-10">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center">
          <img src={klinLogo} alt="KLIN" className="h-13 w-13 object-contain" />
        </div>

        <nav className="flex items-center gap-2">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              title={item.label}
              className={({ isActive }) =>
                cn(
                  "group flex h-11 items-center justify-center gap-2 rounded-full px-4 transition-all duration-150",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                )
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon
                    className={cn(
                      "h-4 w-4 transition-transform duration-150 group-hover:scale-105",
                      isActive ? "text-primary-foreground" : "",
                    )}
                  />
                  <span className="text-xs font-semibold leading-none">{item.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="relative ml-2 flex items-center" ref={searchPanelRef}>
          <div
            className={cn(
              "flex items-center gap-2 rounded-full bg-muted transition-all duration-200",
              searchOpen ? "h-11 w-56 px-4" : "h-11 w-11 justify-center",
            )}
          >
            <button
              type="button"
              onClick={() => {
                if (searchOpen) {
                  setSearchOpen(false);
                  setSearchQuery("");
                  setSearchSubmitted(false);
                  setSearchResults([]);
                  setSearchError(null);
                  setActiveResultIndex(-1);
                } else {
                  setSearchOpen(true);
                }
              }}
              className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
            >
              {searchOpen ? <X className="h-[17px] w-[17px]" /> : <Search className="h-[17px] w-[17px]" />}
            </button>
            {searchOpen && (
              <input
                ref={searchRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={onSearchKeyDown}
                placeholder="Search…"
                className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-hidden"
              />
            )}
          </div>

          {searchOpen && (searchSubmitted || searchLoading || searchError) && (
            <div className="absolute left-0 top-14 z-50 w-120 max-w-[80vw] overflow-hidden rounded-xl border border-border bg-card shadow-lg">
              <div className="border-b border-border bg-muted/50 px-4 py-2 text-[11px] font-black uppercase tracking-widest text-muted-foreground">
                Search Results
              </div>

              <div className="max-h-80 overflow-y-auto p-2">
                {searchLoading ? (
                  <div className="rounded-lg px-3 py-6 text-center text-sm text-muted-foreground">Searching...</div>
                ) : searchError ? (
                  <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-4 text-sm text-destructive">
                    {searchError}
                  </div>
                ) : searchResults.length === 0 ? (
                  <div className="rounded-lg px-3 py-6 text-center text-sm text-muted-foreground">
                    No files found for "{searchQuery.trim()}".
                  </div>
                ) : (
                  <div className="space-y-2">
                    {searchResults.map((item, index) => (
                      <div
                        key={item.id}
                        className={cn(
                          "rounded-lg border border-border bg-card px-3 py-2 transition-colors",
                          activeResultIndex === index ? "bg-accent" : "hover:bg-muted/40",
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-semibold text-foreground">{item.fileName}</p>
                          <Badge variant="secondary" className="uppercase">
                            {item.fileType || "file"}
                          </Badge>
                        </div>
                        <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                          <p className="truncate">Size: {formatSize(item.sizeBytes)}</p>
                          <p className="truncate">Last edit: {formatLastEdited(item.lastEdited)}</p>
                          <p className="col-span-2 truncate">Folder: {item.folder}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex-1" />

        <div className="flex shrink-0 items-center gap-3">
          {profile && (
            <div className="text-right">
              <p className="text-sm font-semibold leading-none text-foreground">{profile.name}</p>
              <p className="mt-0.5 text-[11px] font-black leading-none text-muted-foreground">{profile.email}</p>
            </div>
          )}
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-black text-foreground ring-2 ring-border">
            {profile?.picture ? (
              <img src={profile.picture} alt={profile.name ?? "Profile"} referrerPolicy="no-referrer" className="h-full w-full rounded-full object-cover" />
            ) : (
              profileInitial
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-8 py-6 lg:px-10">
        <Outlet />
      </main>

      <GlobalOrganizeResumeBubble />

      <StartupDialogs
        healthIssues={healthIssues}
        defaultPathSet={defaultPathSet}
        onDismissHealth={() => setHealthIssues([])}
        onDismissDefaultPath={() => setDefaultPathSet(null)}
        onOpenDefaultFolderSettings={() => setShowDefaultFolderSettings(true)}
      />

      <SettingsManagementDialogs
        open={showDefaultFolderSettings}
        sections={["default-folder"]}
        onClose={() => setShowDefaultFolderSettings(false)}
      />
    </div>
  );
}
