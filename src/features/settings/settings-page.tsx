import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  FileX2,
  FolderLock,
  Mail,
  Play,
  RefreshCw,
  Server,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Terminal,
  UserCircle2,
  X,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SettingsManagementDialogs } from "@/features/settings/settings-management-dialogs";
import { cn } from "@/lib/utils";
import { googleAuthService } from "@/features/auth/google-auth-service";
import { useAuthStore } from "@/hooks/auth/use-auth-store";
import { AsyncProcessingQueue } from "@/services/automation-queue";
import { processAutomationJob } from "@/services/automation-service";
import { tauriClient } from "@/services/tauri-client";
import { useAutomationStore } from "@/stores/use-automation-store";
import { usePrivacyStore } from "@/stores/use-privacy-store";
import { useNavigate } from "react-router-dom";

type SettingsTab = "account" | "config" | "automation" | "security";

const TABS: Array<{ id: SettingsTab; label: string; icon: React.ElementType }> = [
  { id: "account", label: "Account", icon: UserCircle2 },
  { id: "config", label: "Configuration", icon: SlidersHorizontal },
  { id: "automation", label: "Automation", icon: Zap },
  { id: "security", label: "Security", icon: ShieldCheck },
];

export function SettingsPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<SettingsTab>("account");
  const [open, setOpen] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isCountingWatcherFiles, setIsCountingWatcherFiles] = useState(false);
  const [watcherFolderStats, setWatcherFolderStats] = useState<Array<{ folderPath: string; fileCount: number }>>([]);
  const [fastApiStatus, setFastApiStatus] = useState<"checking" | "online" | "offline">("checking");
  const [isRefreshingDevHealth, setIsRefreshingDevHealth] = useState(false);
  const [startingSlot, setStartingSlot] = useState<string | null>(null);
  const [slotHealth, setSlotHealth] = useState<Record<string, string | null>>({});

  const watchedFolders = useAutomationStore((state) => state.watchedFolders);
  const isRunning = useAutomationStore((state) => state.isRunning);
  const concurrencyLimit = useAutomationStore((state) => state.concurrencyLimit);
  const setRunning = useAutomationStore((state) => state.setRunning);
  const setLastScanTime = useAutomationStore((state) => state.setLastScanTime);
  const queueRef = useRef(new AsyncProcessingQueue(concurrencyLimit));

  const lockedPaths = usePrivacyStore((state) => state.lockedPaths);
  const lockFile = usePrivacyStore((state) => state.lockFile);
  const lockFolder = usePrivacyStore((state) => state.lockFolder);
  const unlockPath = usePrivacyStore((state) => state.unlockPath);
  const hydrateLocks = usePrivacyStore((state) => state.hydrateFromApi);

  const handleLockFiles = async () => {
    const files = await tauriClient.pickFilesForOrganize().catch(() => []);
    await Promise.all(files.map((filePath) => lockFile(filePath).catch(() => undefined)));
  };

  const handleLockFolder = async () => {
    const folder = await tauriClient.pickFolderForOrganize().catch(() => null);
    if (folder) await lockFolder(folder).catch(() => undefined);
  };

  const checkFastApiHealth = async (showRefreshState = false) => {
    if (showRefreshState) { setIsRefreshingDevHealth(true); setFastApiStatus("checking"); }
    try {
      const response = await fetch("http://127.0.0.1:8000/health", { method: "GET", signal: AbortSignal.timeout(2000) });
      if (response.ok) {
        const data = (await response.json()) as { services?: Record<string, { ok: boolean; detail?: string }> };
        setFastApiStatus(data?.services?.["FastAPI"]?.ok ? "online" : "offline");
        if (showRefreshState) setIsRefreshingDevHealth(false);
        return;
      }
    } catch { }
    setFastApiStatus("offline");
    if (showRefreshState) setIsRefreshingDevHealth(false);
  };

  const slotConfigs = [
    { key: "chat" as const, label: "Chat / Vision", port: 8080 },
    { key: "embed" as const, label: "Embeddings", port: 8081 },
  ];

  const handleStartSlot = async (slot: "chat" | "embed") => {
    setStartingSlot(slot);
    try { await tauriClient.ensureLlamaServer(slot); } catch (e) { console.error(`[dev] ensureLlamaServer(${slot}) failed:`, e); }
    finally { setStartingSlot(null); void checkFastApiHealth(); }
  };

  const checkSlotHealth = async (slot: string, port: number) => {
    setSlotHealth((prev) => ({ ...prev, [slot]: "checking…" }));
    try {
      const res = await fetch(`http://127.0.0.1:${port}/health`, { signal: AbortSignal.timeout(3000) });
      const data = (await res.json()) as { status?: string };
      setSlotHealth((prev) => ({ ...prev, [slot]: data.status ?? (res.ok ? "ok" : `http ${res.status}`) }));
    } catch {
      setSlotHealth((prev) => ({ ...prev, [slot]: "unreachable" }));
    }
  };

  const runScanCycle = async () => {
    if (watchedFolders.length === 0 || isScanning) return;
    setIsScanning(true);
    try {
      const scanned = await Promise.all(watchedFolders.map((folderPath) => tauriClient.readFolder({ folderPath }).catch(() => [])));
      scanned.flat().forEach((filePath) => {
        const fileName = filePath.split(/[\/\\]/).pop() ?? filePath;
        queueRef.current.enqueue(async () => { await processAutomationJob({ filePath, fileName, contentPreview: "" }); });
      });
      setLastScanTime(new Date().toISOString());
    } finally { setIsScanning(false); }
  };

  const refreshWatcherFileCounts = async () => {
    if (!isRunning || watchedFolders.length === 0) { setWatcherFolderStats([]); return; }
    setIsCountingWatcherFiles(true);
    try {
      const counts = await Promise.all(
        watchedFolders.map(async (folderPath) => {
          const files = await tauriClient.readFolder({ folderPath }).catch(() => []);
          return { folderPath, fileCount: files.length };
        }),
      );
      setWatcherFolderStats(counts);
    } finally { setIsCountingWatcherFiles(false); }
  };

  useEffect(() => { void refreshWatcherFileCounts(); }, [isRunning, watchedFolders]);

  useEffect(() => {
    void tauriClient.saveAutomationConfig({ auto_organize_enabled: isRunning, watched_folders: watchedFolders, scan_interval_seconds: 60 }).catch(() => undefined);
  }, [isRunning, watchedFolders]);

  const totalWatchedFiles = useMemo(() => watcherFolderStats.reduce((sum, item) => sum + item.fileCount, 0), [watcherFolderStats]);

  const authStatus = useAuthStore((state) => state.status);
  const authError = useAuthStore((state) => state.error);
  const profile = useAuthStore((state) => state.profile);
  const accessToken = useAuthStore((state) => state.accessToken);
  const expiresAt = useAuthStore((state) => state.expiresAt);
  const initializeAuth = useAuthStore((state) => state.initialize);
  const login = useAuthStore((state) => state.login);
  const logout = useAuthStore((state) => state.logout);

  useEffect(() => { void initializeAuth(); }, [initializeAuth]);
  useEffect(() => { void hydrateLocks().catch(() => undefined); }, [hydrateLocks]);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    void checkFastApiHealth();
    const interval = setInterval(() => { void checkFastApiHealth(); }, 5000);
    return () => clearInterval(interval);
  }, []);

  const isLoggedIn = useMemo(() => {
    if (!accessToken) return false;
    return !googleAuthService.isExpired(expiresAt);
  }, [accessToken, expiresAt]);

  const profileInitial = (profile?.name?.trim()?.charAt(0) || "G").toUpperCase();

  return (
    <div className="flex h-full flex-col gap-5">
      {/* Header */}
      <div className="shrink-0">
        <div className="text-[10.5px] font-extrabold uppercase tracking-widest text-muted-foreground">Preferences</div>
        <h1 className="mt-0.5 text-[21px] font-extrabold tracking-tight text-foreground" style={{ letterSpacing: "-0.4px" }}>
          Settings
        </h1>
      </div>

      {/* Two-panel layout */}
      <div className="grid min-h-0 flex-1 grid-cols-[200px_1fr] gap-4 overflow-hidden">
        {/* Sub-nav sidebar */}
        <div
          className="flex flex-col overflow-hidden rounded-[18px] border border-border bg-card p-3"
          style={{ boxShadow: "0 2px 14px rgba(74,124,247,0.07)" }}
        >
          <div className="mb-2 px-2 text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">
            Sections
          </div>
          <div className="flex flex-col gap-1">
            {TABS.map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-[13px] font-semibold transition-all",
                    active
                      ? "text-white"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                  style={active ? { background: "linear-gradient(135deg,#4a7cf7,#7c3aed)", boxShadow: "0 4px 12px rgba(74,124,247,0.25)" } : undefined}
                >
                  <tab.icon className="h-3.5 w-3.5 shrink-0" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {import.meta.env.DEV && (
            <>
              <div className="my-3 border-t border-border" />
              <div className="mb-1 px-2 text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">
                Developer
              </div>
              <button
                onClick={() => navigate("/settings/api-logs")}
                className="flex items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-[13px] font-semibold text-muted-foreground transition-all hover:bg-muted hover:text-foreground"
              >
                <Terminal className="h-3.5 w-3.5 shrink-0" />
                API Logs
              </button>
            </>
          )}
        </div>

        {/* Content panel */}
        <div
          className="overflow-hidden overflow-y-auto rounded-[18px] border border-border bg-card"
          style={{ boxShadow: "0 2px 14px rgba(74,124,247,0.07)" }}
        >
          {/* Account tab */}
          {activeTab === "account" && (
            <div className="overflow-hidden">
              {!isLoggedIn ? (
                <>
                  {/* Not connected — gradient banner */}
                  <div
                    className="relative overflow-hidden px-6 pb-6 pt-7"
                    style={{ background: "linear-gradient(135deg,#4a7cf7,#7c3aed)" }}
                  >
                    <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full" style={{ background: "rgba(255,255,255,0.08)" }} />
                    <div className="pointer-events-none absolute -bottom-5 left-20 h-20 w-20 rounded-full" style={{ background: "rgba(255,255,255,0.05)" }} />
                    <div className="mb-3.5 flex h-12 w-12 items-center justify-center rounded-[14px]" style={{ background: "rgba(255,255,255,0.18)" }}>
                      <svg className="h-6 w-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M21.8 10.2H12v3.8h5.7c-.5 2.6-2.7 4.4-5.7 4.4-3.5 0-6.3-2.8-6.3-6.3s2.8-6.3 6.3-6.3c1.5 0 2.9.5 4 1.4l2.8-2.8C16.7 2.8 14.5 2 12 2 6.5 2 2 6.5 2 12s4.5 10 10 10c5.5 0 9.7-3.8 9.7-10-.1-.6-.1-1.2-.2-1.8z"/>
                      </svg>
                    </div>
                    <div className="text-[18px] font-extrabold text-white" style={{ letterSpacing: "-0.3px" }}>
                      Connect Google Account
                    </div>
                    <div className="mt-1 text-[13px] text-white/75 leading-relaxed">
                      Sync your profile and Google Calendar events with KLIN
                    </div>
                  </div>

                  <div className="p-6 space-y-5">
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { icon: <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="17" rx="2.5"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>, label: "Calendar Sync", sub: "See your events in KLIN", color: "#4a7cf7" },
                        { icon: <UserCircle2 className="h-3.5 w-3.5" />, label: "Profile Sync", sub: "Name & photo", color: "#10b981" },
                      ].map((f) => (
                        <div key={f.label} className="flex items-center gap-3 rounded-[12px] border border-border p-3 opacity-60" style={{ background: "var(--muted)" }}>
                          <div className="flex h-8 w-8 items-center justify-center rounded-[9px] shrink-0" style={{ background: `${f.color}1a`, color: f.color }}>
                            {f.icon}
                          </div>
                          <div>
                            <div className="text-[12.5px] font-bold text-foreground">{f.label}</div>
                            <div className="text-[11px] text-muted-foreground">{f.sub}</div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <button
                      onClick={() => void login()}
                      disabled={authStatus === "loading"}
                      className="flex w-full items-center justify-center gap-2 rounded-[12px] py-3 text-[13.5px] font-bold text-white transition-colors disabled:opacity-60"
                      style={{ background: "linear-gradient(135deg,#4a7cf7,#7c3aed)", boxShadow: "0 4px 14px rgba(74,124,247,0.30)" }}
                    >
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M21.8 10.2H12v3.8h5.7c-.5 2.6-2.7 4.4-5.7 4.4-3.5 0-6.3-2.8-6.3-6.3s2.8-6.3 6.3-6.3c1.5 0 2.9.5 4 1.4l2.8-2.8C16.7 2.8 14.5 2 12 2 6.5 2 2 6.5 2 12s4.5 10 10 10c5.5 0 9.7-3.8 9.7-10-.1-.6-.1-1.2-.2-1.8z"/>
                      </svg>
                      {authStatus === "loading" ? "Connecting..." : "Connect Google Account"}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  {/* Connected — profile banner */}
                  <div
                    className="relative flex items-center gap-4 overflow-hidden px-6 py-6"
                    style={{ background: "linear-gradient(135deg,#4a7cf7,#7c3aed)" }}
                  >
                    <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full" style={{ background: "rgba(255,255,255,0.08)" }} />
                    {profile?.picture ? (
                      <img src={profile.picture} alt={profile.name} referrerPolicy="no-referrer"
                        className="h-14 w-14 shrink-0 rounded-full object-cover"
                        style={{ border: "3px solid rgba(255,255,255,0.25)" }} />
                    ) : (
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-[22px] font-extrabold text-white"
                        style={{ background: "linear-gradient(135deg,#ea4335,#fbbc05)", border: "3px solid rgba(255,255,255,0.25)" }}>
                        {profileInitial}
                      </div>
                    )}
                    <div className="flex-1">
                      <div className="text-[17px] font-extrabold text-white" style={{ letterSpacing: "-0.3px" }}>
                        {profile?.name ?? "Google Account"}
                      </div>
                      <div className="mt-0.5 flex items-center gap-1 text-[13px] text-white/75">
                        <Mail className="h-3 w-3" />
                        {profile?.email}
                      </div>
                      <div className="mt-2 flex gap-2">
                        <span className="rounded-full px-2.5 py-0.5 text-[10px] font-bold text-white" style={{ background: "rgba(255,255,255,0.2)" }}>● Connected</span>
                        <span className="rounded-full px-2.5 py-0.5 text-[10px] font-bold text-white" style={{ background: "rgba(255,255,255,0.2)" }}>Calendar Synced</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-6 space-y-5">
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { icon: <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="17" rx="2.5"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>, label: "Google Calendar", sub: "Events syncing", color: "#4a7cf7" },
                        { icon: <UserCircle2 className="h-3.5 w-3.5" />, label: "Google Profile", sub: "Name & avatar active", color: "#10b981" },
                      ].map((f) => (
                        <div key={f.label} className="flex items-center gap-3 rounded-[12px] border border-border p-3" style={{ background: "var(--muted)" }}>
                          <div className="flex h-8 w-8 items-center justify-center rounded-[9px] shrink-0" style={{ background: `${f.color}1a`, color: f.color }}>
                            {f.icon}
                          </div>
                          <div>
                            <div className="text-[12.5px] font-bold text-foreground">{f.label}</div>
                            <div className="text-[11px] text-muted-foreground">{f.sub}</div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <button
                      onClick={() => void logout()}
                      className="flex items-center gap-2 rounded-[12px] border px-4 py-2.5 text-[13px] font-bold transition-colors hover:bg-destructive/10"
                      style={{ borderColor: "rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.06)", color: "#ef4444" }}
                    >
                      <X className="h-3.5 w-3.5" />
                      Disconnect Google Account
                    </button>
                  </div>
                </>
              )}

              {authError && <p className="px-6 pb-4 text-[12px] text-destructive">{authError}</p>}
            </div>
          )}

          {/* Configuration tab */}
          {activeTab === "config" && (
            <div className="p-6 space-y-6">
              <div className="flex items-center gap-3">
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-[10px]"
                  style={{ background: "linear-gradient(135deg,#10b981,#0891b2)" }}
                >
                  <Settings className="h-4 w-4 text-white" />
                </div>
                <div>
                  <div className="text-[13px] font-extrabold text-foreground">App Configuration</div>
                  <div className="text-[11px] text-muted-foreground">Manage folders, categories, and defaults</div>
                </div>
              </div>

              <div
                className="flex items-center justify-between rounded-[14px] border border-border p-4"
                style={{ background: "rgba(74,124,247,0.03)" }}
              >
                <div>
                  <div className="text-[13px] font-bold text-foreground">Manage Settings</div>
                  <div className="text-[11px] text-muted-foreground">
                    Configure watched folders, default folder, and categories
                  </div>
                </div>
                <button
                  onClick={() => setOpen(true)}
                  className="flex items-center gap-2 rounded-[9px] border border-border px-3.5 py-2 text-[12.5px] font-bold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  Open
                </button>
              </div>
            </div>
          )}

          {/* Automation tab */}
          {activeTab === "automation" && (
            <div className="p-6 space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-8 w-8 items-center justify-center rounded-[10px]"
                    style={{ background: "linear-gradient(135deg,#f59e0b,#ef4444)" }}
                  >
                    <Zap className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <div className="text-[13px] font-extrabold text-foreground">Auto Organize</div>
                    <div className="text-[11px] text-muted-foreground">Automatically categorize watched folders</div>
                  </div>
                </div>
                {/* Toggle */}
                <button
                  type="button"
                  onClick={() => setRunning(!isRunning)}
                  role="switch"
                  aria-pressed={isRunning}
                  className={cn(
                    "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                    isRunning ? "bg-primary" : "bg-muted-foreground/30",
                  )}
                >
                  <span
                    className={cn(
                      "h-5 w-5 rounded-full bg-white shadow-sm transition-transform",
                      isRunning ? "translate-x-5" : "translate-x-0.5",
                    )}
                  />
                </button>
              </div>

              <div
                className="flex items-center justify-between rounded-[14px] border border-border p-4"
                style={{ background: "rgba(74,124,247,0.03)" }}
              >
                <div>
                  <div className="text-[13px] font-bold text-foreground">Manual Scan</div>
                  <div className="text-[11px] text-muted-foreground">
                    {watchedFolders.length === 0
                      ? "Add watched folders first"
                      : `Scan ${watchedFolders.length} folder${watchedFolders.length !== 1 ? "s" : ""} now`}
                  </div>
                </div>
                <button
                  onClick={() => void runScanCycle()}
                  disabled={isScanning || watchedFolders.length === 0}
                  className="flex items-center gap-2 rounded-[9px] border border-border px-3.5 py-2 text-[12.5px] font-bold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
                >
                  <RefreshCw className={cn("h-3.5 w-3.5", isScanning && "animate-spin")} />
                  {isScanning ? "Scanning..." : "Scan Now"}
                </button>
              </div>

              {isRunning && (
                <div className="rounded-[14px] border border-dashed border-border p-4 space-y-3"
                  style={{ background: "rgba(74,124,247,0.03)" }}>
                  <div className="flex items-center justify-between">
                    <div className="text-[12px] font-bold text-foreground">Watcher File Count</div>
                    <button
                      onClick={() => void refreshWatcherFileCounts()}
                      disabled={isCountingWatcherFiles}
                      className="text-[11px] font-bold text-primary transition-colors hover:opacity-70 disabled:opacity-50"
                    >
                      {isCountingWatcherFiles ? "Refreshing..." : "Refresh"}
                    </button>
                  </div>
                  <div className="rounded-[10px] border border-border px-3 py-2 text-[11.5px] text-muted-foreground">
                    Watching {watchedFolders.length} folder{watchedFolders.length !== 1 ? "s" : ""} with {totalWatchedFiles} file{totalWatchedFiles !== 1 ? "s" : ""} total.
                  </div>
                  {watchedFolders.length === 0 ? (
                    <div className="rounded-[10px] border border-border px-3 py-2 text-[11.5px] text-muted-foreground">
                      No watched folders configured.
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {watcherFolderStats.map((item) => (
                        <div key={item.folderPath}
                          className="flex items-center justify-between rounded-[10px] border border-border px-3 py-2 text-[11.5px]">
                          <span className="min-w-0 truncate font-mono text-muted-foreground" title={item.folderPath}>
                            {item.folderPath}
                          </span>
                          <span className="ml-3 shrink-0 font-bold text-foreground">
                            {item.fileCount} file{item.fileCount !== 1 ? "s" : ""}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {import.meta.env.DEV && (
                <div className="rounded-[14px] border p-4 space-y-4"
                  style={{ borderColor: "rgba(74,124,247,0.2)", background: "rgba(74,124,247,0.04)" }}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Terminal className="h-3.5 w-3.5 text-primary" />
                      <span className="text-[12px] font-extrabold text-primary">Developer — Debug</span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => void checkFastApiHealth(true)}
                        disabled={isRefreshingDevHealth}
                        className="flex items-center gap-1.5 rounded-[9px] border px-3 py-1.5 text-[11.5px] font-bold transition-colors disabled:opacity-50"
                        style={{ borderColor: "rgba(74,124,247,0.2)", color: "#4a7cf7" }}
                      >
                        <RefreshCw className={cn("h-3 w-3", isRefreshingDevHealth && "animate-spin")} />
                        Refresh
                      </button>
                      <button
                        onClick={() => navigate("/settings/api-logs")}
                        className="flex items-center gap-1.5 rounded-[9px] px-3 py-1.5 text-[11.5px] font-bold text-white transition-colors"
                        style={{ background: "rgba(74,124,247,0.85)" }}
                      >
                        <Activity className="h-3 w-3" />
                        API Logs
                      </button>
                    </div>
                  </div>
                  <div className="grid gap-2 md:grid-cols-2">
                    <div className="flex items-center justify-between rounded-[10px] border border-border bg-card px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <Server className="h-3.5 w-3.5 text-primary/70" />
                        <span className="text-[12px] font-medium">FastAPI Backend</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className={cn("h-1.5 w-1.5 rounded-full",
                          fastApiStatus === "checking" ? "animate-pulse bg-muted-foreground"
                            : fastApiStatus === "online" ? "bg-emerald-500"
                              : "bg-destructive")} />
                        <span className={cn("text-[10.5px] font-bold uppercase tracking-wider",
                          fastApiStatus === "online" ? "text-emerald-600"
                            : fastApiStatus === "offline" ? "text-destructive"
                              : "text-muted-foreground")}>
                          {fastApiStatus}
                        </span>
                      </div>
                    </div>
                    {slotConfigs.map(({ key, label, port }) => (
                      <div key={key} className="flex items-center justify-between rounded-[10px] border border-border bg-card px-3 py-2.5">
                        <div className="flex min-w-0 items-center gap-2">
                          <Server className="h-3.5 w-3.5 shrink-0 text-primary/70" />
                          <span className="truncate text-[12px] font-medium">{label}</span>
                          <span className="font-mono text-[10px] text-muted-foreground">:{port}</span>
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5">
                          {slotHealth[key] && (
                            <span className="font-mono text-[10px] text-muted-foreground">{slotHealth[key]}</span>
                          )}
                          <Button variant="outline" size="sm" className="h-6 gap-1 px-2 text-[11px]"
                            onClick={() => void checkSlotHealth(key, port)}>
                            <Activity className="h-2.5 w-2.5" />
                          </Button>
                          <Button variant="outline" size="sm" className="h-6 gap-1 px-2 text-[11px]"
                            onClick={() => void handleStartSlot(key)} disabled={startingSlot === key}>
                            <Play className={cn("h-2.5 w-2.5", startingSlot === key && "animate-pulse")} />
                            {startingSlot === key ? "Starting…" : "Start"}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Security tab */}
          {activeTab === "security" && (
            <div className="p-6 space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-8 w-8 items-center justify-center rounded-[10px]"
                    style={{ background: "linear-gradient(135deg,#8b5cf6,#6d28d9)" }}
                  >
                    <ShieldCheck className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <div className="text-[13px] font-extrabold text-foreground">Locked Paths</div>
                    <div className="text-[11px] text-muted-foreground">Files and folders blocked from AI access</div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => void handleLockFiles()}
                    className="flex items-center gap-1.5 rounded-[9px] border border-border px-3 py-1.5 text-[12px] font-bold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <FileX2 className="h-3.5 w-3.5" />
                    Lock File
                  </button>
                  <button
                    onClick={() => void handleLockFolder()}
                    className="flex items-center gap-1.5 rounded-[9px] border border-border px-3 py-1.5 text-[12px] font-bold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <FolderLock className="h-3.5 w-3.5" />
                    Lock Folder
                  </button>
                </div>
              </div>

              <div className="flex w-fit items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-bold"
                style={{ background: "rgba(139,92,246,0.10)", color: "#8b5cf6" }}>
                <ShieldCheck className="h-3.5 w-3.5" />
                {lockedPaths.length} locked path{lockedPaths.length !== 1 ? "s" : ""} — blocked from AI
              </div>

              <div className="space-y-2">
                {lockedPaths.length === 0 ? (
                  <div className="rounded-[14px] border-2 border-dashed border-border py-10 text-center">
                    <div className="text-[13px] font-bold text-foreground">No locked paths</div>
                    <div className="mt-0.5 text-[12px] text-muted-foreground">
                      Files and folders added here will never be sent to AI
                    </div>
                  </div>
                ) : (
                  lockedPaths.map((p) => (
                    <div key={p}
                      className="flex items-center justify-between rounded-[10px] border border-border px-3 py-2.5 text-[12.5px]"
                      style={{ background: "rgba(139,92,246,0.04)" }}>
                      <span className="min-w-0 truncate font-mono text-foreground" title={p}>{p}</span>
                      <button
                        type="button"
                        onClick={() => unlockPath(p)}
                        className="ml-3 shrink-0 rounded-[7px] border border-border p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <SettingsManagementDialogs
        open={open}
        sections={["default-folder", "watched-folders", "categories"]}
        onClose={() => setOpen(false)}
      />
    </div>
  );
}
