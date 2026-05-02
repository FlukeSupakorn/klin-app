import { useEffect, useRef, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { DashboardPage } from "@/features/dashboard/dashboard-page";
import { HistoryPage } from "@/features/history/history-page";
import { CalendarPage } from "@/features/calendar/calendar-page";
import { NotesPage } from "@/features/notes/notes-page";
import { SettingsPage } from "@/features/settings/settings-page";
import { listen } from "@tauri-apps/api/event";
import {
  CalendarDays,
  FileText,
  History,
  LayoutGrid,
  Settings,
  Folder,
  X,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { bootstrapAppData } from "@/services/bootstrap-service";
import { categoryManagementService } from "@/services/category-management-service";
import { useAuthStore } from "@/hooks/auth/use-auth-store";
import { GlobalOrganizeResumeBubble } from "@/features/dashboard/organize-files-panel/global-organize-resume-bubble";
import { StartupDialogs, runStartupChecks } from "@/features/startup/startup-dialogs";
import type { FailedService } from "@/features/startup/startup-dialogs";
import { SettingsManagementDialogs } from "@/features/settings/settings-management-dialogs";
import { AsyncProcessingQueue } from "@/services/automation-queue";
import { processAutomationJob } from "@/services/automation-service";
import { tauriClient } from "@/services/tauri-client";
import { CloseAppController } from "@/components/dialogs/close-app-controller";
import { useAutomationStore } from "@/stores/use-automation-store";
import { useCategoryManagementStore } from "@/stores/use-category-management-store";
import klinLogo from "@/assets/klin-logo.svg";

const mainNavItems = [
  { to: "/", label: "Dashboard", icon: LayoutGrid },
  { to: "/history", label: "History", icon: History },
  { to: "/calendar", label: "Calendar", icon: CalendarDays },
  { to: "/notes", label: "Notes", icon: FileText },
];

const KEEP_ALIVE_PAGES = [
  { path: "/", component: DashboardPage },
  { path: "/history", component: HistoryPage },
  { path: "/calendar", component: CalendarPage },
  { path: "/notes", component: NotesPage },
  { path: "/settings", component: SettingsPage },
];

export function AppShell() {
  const location = useLocation();
  const segments = location.pathname.split("/").filter(Boolean);
  const currentPath = segments.length > 0 ? `/${segments[0]}` : "/";
  const [mountedPaths, setMountedPaths] = useState(() => new Set([currentPath]));

  useEffect(() => {
    setMountedPaths((prev) => {
      if (prev.has(currentPath)) return prev;
      const next = new Set(prev);
      next.add(currentPath);
      return next;
    });
  }, [currentPath]);

  const initializeAuth = useAuthStore((state) => state.initialize);
  const profile = useAuthStore((state) => state.profile);
  const watchedFolders = useAutomationStore((state) => state.watchedFolders);
  const isAutomationRunning = useAutomationStore((state) => state.isRunning);
  const concurrencyLimit = useAutomationStore((state) => state.concurrencyLimit);
  const addWatchedFolder = useAutomationStore((state) => state.addWatchedFolder);


  const [healthIssues, setHealthIssues] = useState<FailedService[]>([]);
  const [defaultPathSet, setDefaultPathSet] = useState<{ path: string } | null>(null);
  const [showDefaultFolderSettings, setShowDefaultFolderSettings] = useState(false);
  const [recentDetectedFiles, setRecentDetectedFiles] = useState<Array<{ path: string; at: number }>>([]);
  const [fallbackDownloadsFolder, setFallbackDownloadsFolder] = useState<string | null>(null);
  // Real-time watcher queue must be serial (1) — the local LLM handles one inference at a time.
  // Concurrent requests while the model cold-starts cause all but the first to fail with 503.
  const queueRef = useRef(new AsyncProcessingQueue(1));
  const recentEventByPathRef = useRef<Map<string, number>>(new Map());
  const knownFilesByFolderRef = useRef<Map<string, Set<string>>>(new Map());
  // Tracks paths currently in the queue to prevent duplicate jobs from the poll+event combo.
  const activeJobPathsRef = useRef<Set<string>>(new Set());

  const effectiveWatchedFolders = watchedFolders.length > 0
    ? watchedFolders
    : fallbackDownloadsFolder
      ? [fallbackDownloadsFolder]
      : [];

  const handleDetectedFile = (pathFromEvent: string) => {
    if (!pathFromEvent) return;
    if (activeJobPathsRef.current.has(pathFromEvent)) return;
    const now = Date.now();
    const lastSeen = recentEventByPathRef.current.get(pathFromEvent) ?? 0;
    if (now - lastSeen < 3000) return;
    recentEventByPathRef.current.set(pathFromEvent, now);
    const fileName = pathFromEvent.split(/[\\/]/).pop() ?? pathFromEvent;
    setRecentDetectedFiles((state) => {
      const next = [{ path: pathFromEvent, at: now }, ...state.filter((item) => item.path !== pathFromEvent)];
      return next.slice(0, 6);
    });
    if (!useAutomationStore.getState().isRunning) return;
    activeJobPathsRef.current.add(pathFromEvent);
    queueRef.current.enqueue(async () => {
      try {
        await processAutomationJob({ filePath: pathFromEvent, fileName, contentPreview: "" });
      } finally {
        activeJobPathsRef.current.delete(pathFromEvent);
      }
    });
  };

  useEffect(() => {
    void (async () => {
      void initializeAuth();
      const checks = await runStartupChecks().catch(() => ({ healthIssues: [], defaultPathSet: null }));
      setHealthIssues(checks.healthIssues);
      setDefaultPathSet(checks.defaultPathSet);
      void bootstrapAppData().catch(() => undefined);
    })();
  }, [initializeAuth]);

  const foldersEnsuredRef = useRef(false);

  useEffect(() => {
    let disposed = false;
    const syncCategoriesFromWorker = () => {
      void categoryManagementService
        .refreshCategoriesFromWorker()
        .then(() => {
          categoryManagementService.syncToAutomationStores();
          if (!foldersEnsuredRef.current) {
            foldersEnsuredRef.current = true;
            const paths = useCategoryManagementStore.getState().categories
              .filter((c) => c.enabled && c.folderPath.trim().length > 0)
              .map((c) => c.folderPath);
            if (paths.length > 0) {
              void tauriClient.ensureCategoryFolders(paths).catch(() => undefined);
            }
          }
        })
        .catch(() => undefined);
    };
    syncCategoriesFromWorker();
    const retryTimers = [1000, 3000, 7000].map((delay) => window.setTimeout(() => {
      if (!disposed) syncCategoriesFromWorker();
    }, delay));
    const onFocus = () => { syncCategoriesFromWorker(); };
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") syncCategoriesFromWorker();
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


  // Intentionally not syncing concurrencyLimit to queueRef — watcher queue stays serial (1).

  useEffect(() => {
    if (!isAutomationRunning) { setFallbackDownloadsFolder(null); return; }
    void tauriClient.getDownloadsFolder().then((downloadsPath) => {
      if (!downloadsPath) return;
      setFallbackDownloadsFolder(downloadsPath);
      if (watchedFolders.length > 0) return;
      addWatchedFolder(downloadsPath);
    }).catch(() => undefined);
  }, [isAutomationRunning, watchedFolders, addWatchedFolder]);

  useEffect(() => {
    if (!isAutomationRunning || effectiveWatchedFolders.length === 0) return;
    void Promise.all(effectiveWatchedFolders.map((folderPath) => tauriClient.watchFolder({ folderPath }))).catch(() => undefined);
  }, [isAutomationRunning, effectiveWatchedFolders]);

  useEffect(() => {
    let unlistener: (() => void) | null = null;
    void (async () => {
      unlistener = await listen<{ filePath?: string; file_path?: string }>("watcher://file-created", (event) => {
        const pathFromEvent = event.payload?.filePath ?? event.payload?.file_path;
        if (!pathFromEvent) return;
        handleDetectedFile(pathFromEvent);
      });
    })();
    return () => { unlistener?.(); };
  }, []);

  useEffect(() => {
    if (!isAutomationRunning || effectiveWatchedFolders.length === 0) {
      knownFilesByFolderRef.current.clear(); return;
    }
    let disposed = false;
    const syncFolderState = async () => {
      await Promise.all(effectiveWatchedFolders.map(async (folderPath) => {
        const files = await tauriClient.readFolder({ folderPath }).catch(() => [] as string[]);
        if (disposed) return;
        const previous = knownFilesByFolderRef.current.get(folderPath);
        const currentSet = new Set(files);
        knownFilesByFolderRef.current.set(folderPath, currentSet);
        if (!previous) return;
        files.forEach((filePath) => {
          if (!previous.has(filePath)) handleDetectedFile(filePath);
        });
      }));
    };
    void syncFolderState();
    const timer = window.setInterval(() => { void syncFolderState(); }, 5000);
    return () => { disposed = true; window.clearInterval(timer); };
  }, [isAutomationRunning, effectiveWatchedFolders]);

  const profileInitial = (profile?.name?.trim()?.charAt(0) || "K").toUpperCase();
  const totalFiles = watchedFolders.length;

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      {/* ─── Sidebar ─── */}
      <aside
        className="flex h-full w-[220px] shrink-0 flex-col overflow-y-auto border-r border-border bg-card"
        style={{ boxShadow: "var(--shadow-xs)" }}
      >
        {/* Logo + Watcher card */}
        <div className="shrink-0 border-b border-border p-4">
          {/* Logo */}
          <div className="mb-4 flex items-center gap-2.5">
            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px]"
              style={{ background: "var(--primary)" }}
            >
              <Folder className="h-4 w-4 text-white" />
            </div>
            <span className="text-base font-extrabold tracking-tight text-foreground">KLIN</span>
          </div>

          {/* Watcher card */}
          <div
            className="relative overflow-hidden rounded-[14px] p-3.5 text-white"
            style={{ background: "var(--primary)" }}
          >
            <div
              className="pointer-events-none absolute -right-5 -top-5 h-20 w-20 rounded-full"
              style={{ background: "rgba(255,255,255,0.10)" }}
            />
            <div className="text-[9.5px] font-extrabold uppercase tracking-widest opacity-80">Watcher</div>
            <div className="mt-0.5 text-xl font-extrabold leading-tight" style={{ letterSpacing: "-1px" }}>
              {watchedFolders.length} <span className="text-xs font-semibold opacity-80">folder{watchedFolders.length !== 1 ? "s" : ""}</span>
            </div>
            <div className="mt-1.5 flex items-center gap-1.5">
              <div
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: isAutomationRunning ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.35)" }}
              />
              <div className="text-[10.5px] opacity-80">
                Auto organize <span className="font-bold">{isAutomationRunning ? "on" : "off"}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex flex-1 flex-col gap-0.5 p-2 pt-2.5">
          <div className="mb-1.5 px-2 text-[9.5px] font-extrabold uppercase tracking-widest text-muted-foreground">Menu</div>
          {mainNavItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-[13px] font-medium transition-all duration-150",
                  isActive
                    ? "bg-primary/10 font-bold text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon className={cn("h-[15px] w-[15px] shrink-0", isActive ? "text-primary" : "text-muted-foreground")} />
                  <span className="flex-1">{item.label}</span>
                  {isActive && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />}
                </>
              )}
            </NavLink>
          ))}

          <div className="mt-2.5 mb-1.5 px-2 text-[9.5px] font-extrabold uppercase tracking-widest text-muted-foreground">System</div>
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              cn(
                "flex items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-[13px] font-medium transition-all duration-150",
                isActive
                  ? "bg-primary/10 font-bold text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )
            }
          >
            {({ isActive }) => (
              <>
                <Settings className={cn("h-[15px] w-[15px] shrink-0", isActive ? "text-primary" : "text-muted-foreground")} />
                <span className="flex-1">Settings</span>
                {isActive && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />}
              </>
            )}
          </NavLink>
        </nav>

        {/* User footer */}
        <div className="shrink-0 border-t border-border p-3">
          <div className="flex items-center gap-2.5">
            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-extrabold text-white"
              style={{ background: profile?.picture ? undefined : "var(--primary)" }}
            >
              {profile?.picture ? (
                <img
                  src={profile.picture}
                  alt={profile.name ?? "Profile"}
                  referrerPolicy="no-referrer"
                  className="h-full w-full rounded-full object-cover"
                />
              ) : (
                profile ? profileInitial : "K"
              )}
            </div>
            <div className="min-w-0">
              {profile ? (
                <div className="truncate text-[12px] font-bold text-foreground">{profile.name}</div>
              ) : (
                <div className="truncate text-[12px] font-bold text-muted-foreground">Sign in</div>
              )}
            </div>
          </div>
        </div>
      </aside>

      {/* ─── Page content — keep-alive: mount once, hide with display:none ─── */}
      <main className="relative flex flex-1 overflow-hidden">
        {KEEP_ALIVE_PAGES.map(({ path, component: Page }) =>
          mountedPaths.has(path) ? (
            <div
              key={path}
              className="flex h-full w-full flex-col overflow-hidden px-[26px] py-[26px] pb-[22px]"
              style={{ display: currentPath === path ? "flex" : "none" }}
            >
              <Page />
            </div>
          ) : null,
        )}
      </main>

      <GlobalOrganizeResumeBubble />

      {/* New File Detected toast */}
      {recentDetectedFiles.length > 0 && (
        <div className="klin-toast-in pointer-events-none fixed bottom-6 right-6 z-50 w-[320px] max-w-[90vw] overflow-hidden rounded-[16px] border border-border bg-card shadow-lg">
          <div className="h-0.5 w-full" style={{ background: "var(--primary)" }} />
          <div className="p-3.5">
            <div className="mb-2 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-[7px]"
                  style={{ background: "var(--success)" }}>
                  <Zap className="h-3 w-3 text-white" />
                </div>
                <p className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-500">New File Detected</p>
              </div>
              <button
                type="button"
                className="pointer-events-auto flex h-6 w-6 items-center justify-center rounded-[7px] border border-border bg-muted text-muted-foreground hover:text-foreground"
                onClick={() => setRecentDetectedFiles([])}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
            <div className="space-y-1.5">
              {recentDetectedFiles.map((item) => {
                const name = item.path.split(/[\\/]/).pop() ?? item.path;
                return (
                  <div key={item.path} className="rounded-[9px] bg-muted/60 px-2.5 py-1.5">
                    <p className="truncate text-[12px] font-bold text-foreground" title={item.path}>{name}</p>
                    <p className="truncate text-[10.5px] text-muted-foreground" style={{ fontFamily: "'JetBrains Mono',monospace" }} title={item.path}>{item.path}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

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

      <CloseAppController />
    </div>
  );
}
