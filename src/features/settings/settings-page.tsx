import { type Dispatch, type SetStateAction, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  CheckCircle2,
  ChevronDown,
  Eye,
  FileText,
  FileX2,
  FolderLock,
  FolderOpen,
  FolderPlus,
  FolderSearch,
  Lock,
  LockOpen,
  Mail,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  ScanSearch,
  Server,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Terminal,
  Trash2,
  UserCircle2,
  X,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BatchCategoryModal } from "@/features/categories/batch-category-modal";
import {
  CATEGORY_ICON_OPTIONS,
  getCategoryIcon,
  withAlpha,
} from "@/features/categories/category-appearance";
import { cn } from "@/lib/utils";
import { googleAuthService } from "@/features/auth/google-auth-service";
import { useAuthStore } from "@/hooks/auth/use-auth-store";
import { categoryManagementService } from "@/services/category-management-service";
import { AsyncProcessingQueue } from "@/services/automation-queue";
import { processAutomationJob } from "@/services/automation-service";
import { tauriClient } from "@/services/tauri-client";
import { useAutomationStore } from "@/stores/use-automation-store";
import { useCategoryManagementStore } from "@/stores/use-category-management-store";
import { usePrivacyStore } from "@/stores/use-privacy-store";
import type { ManagedCategory } from "@/types/domain";
import { joinFolderPath } from "@/lib/path-utils";
import { useNavigate } from "react-router-dom";

type SettingsTab = "account" | "config" | "automation" | "security" | "developer";
type CategoryEditorMode = "add" | "edit";

interface CategoryFormState {
  name: string;
  description: string;
  color: string;
  icon: string;
  folderPath: string;
  enabled: boolean;
  aiLearned: boolean;
}

const emptyForm: CategoryFormState = {
  name: "",
  description: "",
  color: "#6366f1",
  icon: "FileText",
  folderPath: "",
  enabled: true,
  aiLearned: true,
};

function joinDefaultFolderPath(basePath: string, categoryName: string): string {
  return joinFolderPath(basePath, categoryName);
}

function normalizeHexColor(value: string, fallback = "#6366f1"): string {
  const trimmed = value.trim();
  return /^#[0-9a-fA-F]{6}$/.test(trimmed) ? trimmed.toLowerCase() : fallback;
}

const MAIN_TABS: Array<{ id: SettingsTab; label: string; icon: React.ElementType }> = [
  { id: "account", label: "Account", icon: UserCircle2 },
  { id: "config", label: "Configuration", icon: SlidersHorizontal },
  { id: "automation", label: "Automation", icon: Zap },
  { id: "security", label: "Security", icon: ShieldCheck },
];

/* ── Category Editor Modal ── */
interface CategoryEditorModalProps {
  mode: CategoryEditorMode;
  formState: CategoryFormState;
  onFormChange: Dispatch<SetStateAction<CategoryFormState>>;
  onClose: () => void;
  onSave: () => Promise<void>;
  saveError: string | null;
  isSaving: boolean;
  defaultFolder: string;
}

function CategoryEditorModal({ mode, formState, onFormChange, onClose, onSave, saveError, isSaving, defaultFolder }: CategoryEditorModalProps) {
  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg overflow-hidden rounded-[18px] border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <div className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">Category</div>
            <div className="text-[16px] font-extrabold text-foreground">
              {mode === "edit" ? "Edit Category" : "Add Category"}
            </div>
          </div>
          <button type="button" onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-[9px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto p-5 space-y-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">Name</label>
            <Input
              value={formState.name}
              onChange={(e) => {
                const nextName = e.target.value;
                onFormChange((state) => {
                  if (mode !== "add") return { ...state, name: nextName };
                  const prevAutoPath = joinDefaultFolderPath(defaultFolder, state.name.trim() || "New Category");
                  const shouldAutoUpdatePath = state.folderPath.trim() === prevAutoPath;
                  return {
                    ...state,
                    name: nextName,
                    folderPath: shouldAutoUpdatePath
                      ? joinDefaultFolderPath(defaultFolder, nextName.trim() || "New Category")
                      : state.folderPath,
                  };
                });
              }}
              className="border-border bg-muted"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">Description</label>
            <textarea
              value={formState.description}
              onChange={(e) => onFormChange((s) => ({ ...s, description: e.target.value }))}
              className="min-h-20 w-full resize-none rounded-[10px] border border-border bg-muted px-3 py-2 text-sm text-foreground focus:outline-none"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">Icon</label>
            <div className="grid grid-cols-8 gap-1.5">
              {CATEGORY_ICON_OPTIONS.map((option) => {
                const Icon = option.icon;
                return (
                  <button key={option.name} type="button"
                    onClick={() => onFormChange((s) => ({ ...s, icon: option.name }))}
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-[8px] border transition-all",
                      formState.icon === option.name
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-muted/30 text-muted-foreground hover:text-foreground",
                    )}
                    title={option.label}
                  >
                    <Icon className="h-4 w-4" />
                  </button>
                );
              })}
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">Color</label>
            <div className="flex items-center gap-2">
              <input type="color" value={formState.color}
                onChange={(e) => onFormChange((s) => ({ ...s, color: e.target.value }))}
                className="h-9 w-12 cursor-pointer rounded-[8px] border border-border bg-muted p-1"
              />
              <Input value={formState.color}
                onChange={(e) => onFormChange((s) => ({ ...s, color: e.target.value }))}
                className="border-border bg-muted font-mono" placeholder="#6366f1"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">Folder Path</label>
            <div className="flex items-center gap-2">
              <Input value={formState.folderPath}
                onChange={(e) => onFormChange((s) => ({ ...s, folderPath: e.target.value }))}
                placeholder="Folder path" className="border-border bg-muted font-mono"
              />
              <button type="button"
                onClick={async () => {
                  const folder = await tauriClient.pickFolderForOrganize().catch(() => null);
                  if (folder) onFormChange((s) => ({ ...s, folderPath: folder }));
                }}
                className="shrink-0 rounded-[8px] border border-border p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <FolderSearch className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-[10px] border border-border bg-muted/30 px-3 py-2.5 text-xs">
            <CheckCircle2 className={cn("h-3.5 w-3.5", formState.aiLearned ? "text-primary" : "text-muted-foreground")} />
            <span className={formState.aiLearned ? "text-foreground" : "text-muted-foreground"}>
              {formState.aiLearned ? "AI learned" : "AI learning"}
            </span>
          </div>
          {saveError && <p className="text-xs text-destructive">{saveError}</p>}
          <div className="flex justify-between pt-1">
            <Button variant="outline" onClick={onClose} disabled={isSaving}>Cancel</Button>
            <Button onClick={() => void onSave()} disabled={isSaving}>
              {isSaving ? "Saving..." : mode === "edit" ? "Save Changes" : "Add Category"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Main Page ── */
export function SettingsPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<SettingsTab>("account");

  /* ── Config tab state ── */
  const defaultFolder = useCategoryManagementStore((s) => s.defaultFolder);
  const categories = useCategoryManagementStore((s) => s.categories);
  const [draftDefaultFolder, setDraftDefaultFolder] = useState(defaultFolder);
  const [isSavingDefaultFolder, setIsSavingDefaultFolder] = useState(false);
  const [defaultFolderError, setDefaultFolderError] = useState<string | null>(null);

  const watchedFolders = useAutomationStore((s) => s.watchedFolders);
  const addWatchedFolder = useAutomationStore((s) => s.addWatchedFolder);
  const removeWatchedFolder = useAutomationStore((s) => s.removeWatchedFolder);
  const [newWatchedPath, setNewWatchedPath] = useState("");
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  const categoryDropdownRef = useRef<HTMLDivElement>(null);

  const [catEditorMode, setCatEditorMode] = useState<CategoryEditorMode | null>(null);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [catFormState, setCatFormState] = useState<CategoryFormState>(emptyForm);
  const [catSaveError, setCatSaveError] = useState<string | null>(null);
  const [isSavingCategory, setIsSavingCategory] = useState(false);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [batchInitialFolders, setBatchInitialFolders] = useState<string[]>([]);

  const sortedCategories = useMemo(() =>
    [...categories].sort((a, b) => {
      if (a.enabled !== b.enabled) return a.enabled ? -1 : 1;
      return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    }),
    [categories],
  );

  useEffect(() => { setDraftDefaultFolder(defaultFolder); }, [defaultFolder]);

  useEffect(() => {
    if (activeTab !== "config") return;
    void categoryManagementService.refreshCategoriesFromWorker().then(() => categoryManagementService.syncToAutomationStores());
  }, [activeTab]);

  const persistDefaultFolder = async (path: string) => {
    const normalized = path.trim();
    if (!normalized) return;
    setIsSavingDefaultFolder(true);
    setDefaultFolderError(null);
    try {
      await categoryManagementService.saveDefaultFolder(normalized);
      categoryManagementService.syncToAutomationStores();
      setDraftDefaultFolder(normalized);
    } catch (err) {
      setDefaultFolderError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setIsSavingDefaultFolder(false);
    }
  };

  const browseDefaultFolder = async () => {
    const folder = await tauriClient.pickFolderForOrganize().catch(() => null);
    if (folder) await persistDefaultFolder(folder);
  };

  const openCatAdd = () => {
    setCatEditorMode("add");
    setEditingCategoryId(null);
    setCatSaveError(null);
    setCatFormState({ ...emptyForm, folderPath: joinDefaultFolderPath(defaultFolder, "New Category") });
  };

  const openCatEdit = (category: ManagedCategory) => {
    setCatEditorMode("edit");
    setEditingCategoryId(category.id);
    setCatSaveError(null);
    setCatFormState({
      name: category.name,
      description: category.description,
      color: category.color,
      icon: category.icon,
      folderPath: category.folderPath,
      enabled: category.enabled,
      aiLearned: category.aiLearned,
    });
  };

  const closeCatEditor = () => {
    setCatEditorMode(null);
    setEditingCategoryId(null);
    setCatSaveError(null);
    setCatFormState(emptyForm);
  };

  const openBatch = async () => {
    const picked = await tauriClient.pickFoldersForBatch().catch(() => [] as string[]);
    if (!picked.length) return;
    setBatchInitialFolders(picked);
    setShowBatchModal(true);
  };

  const handleSaveCategory = async () => {
    const normalizedName = catFormState.name.trim();
    if (!normalizedName) { setCatSaveError("Category name is required"); return; }
    if (catEditorMode === "edit" && !editingCategoryId) { setCatSaveError("Category ID is missing"); return; }
    const normalizedColor = normalizeHexColor(catFormState.color, "#6366f1");
    const normalizedFolderPath = catFormState.folderPath.trim() || joinDefaultFolderPath(defaultFolder, normalizedName);
    setCatSaveError(null);
    setIsSavingCategory(true);
    try {
      if (catEditorMode === "edit" && editingCategoryId) {
        await categoryManagementService.updateCategoryInWorker(editingCategoryId, {
          name: normalizedName, description: catFormState.description.trim(),
          color: normalizedColor, icon: catFormState.icon,
          folderPath: normalizedFolderPath, enabled: catFormState.enabled, aiLearned: catFormState.aiLearned,
        });
      } else if (catEditorMode === "add") {
        await categoryManagementService.addCategoryToWorker({
          name: normalizedName, description: catFormState.description.trim(),
          color: normalizedColor, icon: catFormState.icon,
          folderPath: normalizedFolderPath, enabled: catFormState.enabled, aiLearned: catFormState.aiLearned,
          isAutoDescription: false,
        });
      }
      categoryManagementService.syncToAutomationStores();
      closeCatEditor();
    } catch (error) {
      setCatSaveError(error instanceof Error ? error.message : "Failed to save category");
    } finally {
      setIsSavingCategory(false);
    }
  };

  const toggleCategoryEnabled = (category: ManagedCategory) => {
    void categoryManagementService
      .updateCategoryInWorker(category.id, { enabled: !category.enabled })
      .then(() => categoryManagementService.syncToAutomationStores());
  };

  const deleteCategory = (category: ManagedCategory) => {
    void categoryManagementService
      .deleteCategoryInWorker(category.id)
      .then(() => categoryManagementService.syncToAutomationStores());
  };

  /* ── Automation tab state ── */
  const isRunning = useAutomationStore((s) => s.isRunning);
  const concurrencyLimit = useAutomationStore((s) => s.concurrencyLimit);
  const setRunning = useAutomationStore((s) => s.setRunning);
  const setLastScanTime = useAutomationStore((s) => s.setLastScanTime);
  const queueRef = useRef(new AsyncProcessingQueue(concurrencyLimit));

  const [isScanning, setIsScanning] = useState(false);
  const [isCountingWatcherFiles, setIsCountingWatcherFiles] = useState(false);
  const [watcherFolderStats, setWatcherFolderStats] = useState<Array<{ folderPath: string; fileCount: number }>>([]);

  const refreshWatcherFileCounts = useCallback(async () => {
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
  }, [isRunning, watchedFolders]);

  useEffect(() => { void refreshWatcherFileCounts(); }, [refreshWatcherFileCounts]);

  useEffect(() => {
    void tauriClient.saveAutomationConfig({ auto_organize_enabled: isRunning, watched_folders: watchedFolders, scan_interval_seconds: 60 }).catch(() => undefined);
  }, [isRunning, watchedFolders]);

  const totalWatchedFiles = useMemo(() => watcherFolderStats.reduce((sum, item) => sum + item.fileCount, 0), [watcherFolderStats]);

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

  /* ── Security tab state ── */
  const lockedPaths = usePrivacyStore((s) => s.lockedPaths);
  const lockFile = usePrivacyStore((s) => s.lockFile);
  const lockFolder = usePrivacyStore((s) => s.lockFolder);
  const unlockPath = usePrivacyStore((s) => s.unlockPath);
  const hydrateLocks = usePrivacyStore((s) => s.hydrateFromApi);

  const handleLockFiles = async () => {
    const files = await tauriClient.pickFilesForOrganize().catch(() => []);
    await Promise.all(files.map((filePath) => lockFile(filePath).catch(() => undefined)));
  };
  const handleLockFolder = async () => {
    const folder = await tauriClient.pickFolderForOrganize().catch(() => null);
    if (folder) await lockFolder(folder).catch(() => undefined);
  };

  /* ── Developer tab state ── */
  const [fastApiStatus, setFastApiStatus] = useState<"checking" | "online" | "offline">("checking");
  const [isRefreshingDevHealth, setIsRefreshingDevHealth] = useState(false);
  const [startingSlot, setStartingSlot] = useState<string | null>(null);
  const [slotHealth, setSlotHealth] = useState<Record<string, string | null>>({});

  const checkFastApiHealth = async (showRefreshState = false) => {
    if (showRefreshState) { setIsRefreshingDevHealth(true); setFastApiStatus("checking"); }
    try {
      const res = await fetch("http://127.0.0.1:8000/health", { method: "GET", signal: AbortSignal.timeout(2000) });
      if (res.ok) {
        const data = (await res.json()) as { services?: Record<string, { ok: boolean }> };
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
    try { await tauriClient.ensureLlamaServer(slot); } catch (e) { console.error(e); }
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

  /* ── Auth ── */
  const authStatus = useAuthStore((s) => s.status);
  const authError = useAuthStore((s) => s.error);
  const profile = useAuthStore((s) => s.profile);
  const accessToken = useAuthStore((s) => s.accessToken);
  const expiresAt = useAuthStore((s) => s.expiresAt);
  const initializeAuth = useAuthStore((s) => s.initialize);
  const login = useAuthStore((s) => s.login);
  const logout = useAuthStore((s) => s.logout);

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
      <div className="shrink-0">
        <div className="text-[10.5px] font-extrabold uppercase tracking-widest text-muted-foreground">Preferences</div>
        <h1 className="mt-0.5 text-[21px] font-extrabold tracking-tight text-foreground" style={{ letterSpacing: "-0.4px" }}>
          Settings
        </h1>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[180px_1fr] gap-4 overflow-hidden">
        {/* Sidebar nav */}
        <div className="flex flex-col overflow-hidden rounded-[18px] border border-border bg-card p-3" style={{ boxShadow: "var(--shadow-xs)" }}>
          <div className="mb-2 px-2 text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">Sections</div>
          <div className="flex flex-col gap-1">
            {MAIN_TABS.map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex items-center gap-2.5 rounded-[11px] px-3 py-2.5 text-[13px] font-semibold transition-all",
                    active ? "text-white" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                  style={active ? { background: "var(--primary)", boxShadow: "0 4px 12px var(--primary-glow)" } : undefined}
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
              <div className="mb-1.5 px-2 text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">Developer</div>
              <button type="button" onClick={() => setActiveTab("developer")}
                className={cn(
                  "flex items-center gap-2.5 rounded-[11px] px-3 py-2.5 text-[13px] font-semibold transition-all",
                  activeTab === "developer" ? "text-white" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
                style={activeTab === "developer" ? { background: "var(--primary)", boxShadow: "0 4px 12px var(--primary-glow)" } : undefined}
              >
                <Terminal className="h-3.5 w-3.5 shrink-0" />
                Debug
              </button>
              <button type="button" onClick={() => navigate("/settings/api-logs")}
                className="flex items-center gap-2.5 rounded-[11px] px-3 py-2.5 text-[13px] font-semibold text-muted-foreground transition-all hover:bg-muted hover:text-foreground"
              >
                <Activity className="h-3.5 w-3.5 shrink-0" />
                API Logs
              </button>
            </>
          )}
        </div>

        {/* Content panel */}
        <div className="overflow-y-auto rounded-[18px] border border-border bg-card" style={{ boxShadow: "var(--shadow-xs)" }}>

          {/* ── Account ── */}
          {activeTab === "account" && (
            <div className="overflow-hidden">
              {!isLoggedIn ? (
                <>
                  <div className="relative overflow-hidden px-6 pb-6 pt-7" style={{ background: "var(--primary)" }}>
                    <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full" style={{ background: "rgba(255,255,255,0.08)" }} />
                    <div className="pointer-events-none absolute -bottom-5 left-20 h-20 w-20 rounded-full" style={{ background: "rgba(255,255,255,0.05)" }} />
                    <div className="mb-3.5 flex h-12 w-12 items-center justify-center rounded-[14px]" style={{ background: "rgba(255,255,255,0.18)" }}>
                      <svg className="h-6 w-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M21.8 10.2H12v3.8h5.7c-.5 2.6-2.7 4.4-5.7 4.4-3.5 0-6.3-2.8-6.3-6.3s2.8-6.3 6.3-6.3c1.5 0 2.9.5 4 1.4l2.8-2.8C16.7 2.8 14.5 2 12 2 6.5 2 2 6.5 2 12s4.5 10 10 10c5.5 0 9.7-3.8 9.7-10-.1-.6-.1-1.2-.2-1.8z" />
                      </svg>
                    </div>
                    <div className="text-[18px] font-extrabold text-white" style={{ letterSpacing: "-0.3px" }}>Connect Google Account</div>
                    <div className="mt-1 text-[13px] leading-relaxed text-white/75">Sync your profile and Google Calendar events with KLIN</div>
                  </div>
                  <div className="space-y-5 p-6">
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { icon: <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="17" rx="2.5" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>, label: "Calendar Sync", sub: "See your events in KLIN", tint: "var(--primary-tint)", fg: "var(--primary)" },
                        { icon: <UserCircle2 className="h-3.5 w-3.5" />, label: "Profile Sync", sub: "Name & photo", tint: "var(--success-tint)", fg: "var(--success)" },
                      ].map((f) => (
                        <div key={f.label} className="flex items-center gap-3 rounded-[12px] border border-border p-3 opacity-60" style={{ background: "var(--muted)" }}>
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px]" style={{ background: f.tint, color: f.fg }}>{f.icon}</div>
                          <div>
                            <div className="text-[12.5px] font-bold text-foreground">{f.label}</div>
                            <div className="text-[11px] text-muted-foreground">{f.sub}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <button type="button" onClick={() => void login()} disabled={authStatus === "loading"}
                      className="flex w-full items-center justify-center gap-2 rounded-[12px] py-3 text-[13.5px] font-bold text-white transition-colors disabled:opacity-60"
                      style={{ background: "var(--primary)", boxShadow: "0 4px 14px var(--primary-glow)" }}>
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M21.8 10.2H12v3.8h5.7c-.5 2.6-2.7 4.4-5.7 4.4-3.5 0-6.3-2.8-6.3-6.3s2.8-6.3 6.3-6.3c1.5 0 2.9.5 4 1.4l2.8-2.8C16.7 2.8 14.5 2 12 2 6.5 2 2 6.5 2 12s4.5 10 10 10c5.5 0 9.7-3.8 9.7-10-.1-.6-.1-1.2-.2-1.8z" /></svg>
                      {authStatus === "loading" ? "Connecting..." : "Connect Google Account"}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="relative flex items-center gap-4 overflow-hidden px-6 py-6" style={{ background: "var(--primary)" }}>
                    <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full" style={{ background: "rgba(255,255,255,0.08)" }} />
                    {profile?.picture ? (
                      <img src={profile.picture} alt={profile.name} referrerPolicy="no-referrer"
                        className="h-14 w-14 shrink-0 rounded-full object-cover" style={{ border: "3px solid rgba(255,255,255,0.25)" }} />
                    ) : (
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-[22px] font-extrabold text-white"
                        style={{ background: "#ea4335", border: "3px solid rgba(255,255,255,0.25)" }}>
                        {profileInitial}
                      </div>
                    )}
                    <div className="flex-1">
                      <div className="text-[17px] font-extrabold text-white" style={{ letterSpacing: "-0.3px" }}>{profile?.name ?? "Google Account"}</div>
                      <div className="mt-0.5 flex items-center gap-1 text-[13px] text-white/75"><Mail className="h-3 w-3" />{profile?.email}</div>
                      <div className="mt-2 flex gap-2">
                        <span className="rounded-full px-2.5 py-0.5 text-[10px] font-bold text-white" style={{ background: "rgba(255,255,255,0.2)" }}>● Connected</span>
                        <span className="rounded-full px-2.5 py-0.5 text-[10px] font-bold text-white" style={{ background: "rgba(255,255,255,0.2)" }}>Calendar Synced</span>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-5 p-6">
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { icon: <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="17" rx="2.5" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>, label: "Google Calendar", sub: "Events syncing", tint: "var(--primary-tint)", fg: "var(--primary)" },
                        { icon: <UserCircle2 className="h-3.5 w-3.5" />, label: "Google Profile", sub: "Name & avatar active", tint: "var(--success-tint)", fg: "var(--success)" },
                      ].map((f) => (
                        <div key={f.label} className="flex items-center gap-3 rounded-[12px] border border-border p-3" style={{ background: "var(--muted)" }}>
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px]" style={{ background: f.tint, color: f.fg }}>{f.icon}</div>
                          <div>
                            <div className="text-[12.5px] font-bold text-foreground">{f.label}</div>
                            <div className="text-[11px] text-muted-foreground">{f.sub}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <button type="button" onClick={() => void logout()}
                      className="flex items-center gap-2 rounded-[12px] border px-4 py-2.5 text-[13px] font-bold transition-colors hover:bg-destructive/10"
                      style={{ borderColor: "var(--destructive-border)", background: "var(--destructive-tint)", color: "var(--destructive)" }}>
                      <X className="h-3.5 w-3.5" />Disconnect Google Account
                    </button>
                  </div>
                </>
              )}
              {authError && <p className="px-6 pb-4 text-[12px] text-destructive">{authError}</p>}
            </div>
          )}

          {/* ── Configuration ── */}
          {activeTab === "config" && (
            <div className="space-y-5 p-5">

              {/* Default Output Folder */}
              <div className="space-y-3">
                <div className="text-[10.5px] font-extrabold uppercase tracking-widest text-muted-foreground">Default Output Folder</div>
                <div className="flex gap-2">
                  <div className="flex h-10 flex-1 items-center gap-2 rounded-[11px] border border-border bg-muted px-3">
                    <FolderOpen className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <input
                      value={draftDefaultFolder}
                      onChange={(e) => setDraftDefaultFolder(e.target.value)}
                      placeholder="Base path for categories (e.g. /home/user/KlinFiles)"
                      className="flex-1 bg-transparent font-mono text-[12.5px] text-foreground placeholder:text-muted-foreground focus:outline-none"
                    />
                  </div>
                  <button type="button" onClick={() => void browseDefaultFolder()} disabled={isSavingDefaultFolder}
                    className="flex shrink-0 items-center gap-1.5 rounded-[11px] border border-border px-3 py-2 text-[12.5px] font-bold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50">
                    <FolderSearch className="h-3.5 w-3.5" />Browse
                  </button>
                  <button type="button" onClick={() => void persistDefaultFolder(draftDefaultFolder)} disabled={isSavingDefaultFolder || !draftDefaultFolder.trim()}
                    className="flex shrink-0 items-center gap-1.5 rounded-[11px] px-3.5 py-2 text-[12.5px] font-bold text-white transition-colors disabled:opacity-50"
                    style={{ background: "var(--primary)", boxShadow: "0 3px 10px var(--primary-glow)" }}>
                    {isSavingDefaultFolder ? "Saving..." : "Save"}
                  </button>
                </div>
                {defaultFolderError && <p className="text-[11px] text-destructive">{defaultFolderError}</p>}
              </div>

              <div className="border-t border-border" />

              {/* Watched Folders */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-[10.5px] font-extrabold uppercase tracking-widest text-muted-foreground">Watched Folders</div>
                  <span className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                    style={{ background: "var(--success-tint)", color: "var(--success)" }}>
                    {watchedFolders.length} active
                  </span>
                </div>

                {/* Quick-add buttons */}
                <div className="grid grid-cols-2 gap-2">
                  <button type="button"
                    onClick={async () => addWatchedFolder(await tauriClient.getDownloadsFolder())}
                    className="flex items-center justify-center gap-2 rounded-[11px] border border-border px-3 py-2 text-[12.5px] font-bold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                    <FolderPlus className="h-3.5 w-3.5" />Add Downloads
                  </button>
                  <button type="button"
                    onClick={async () => {
                      const folder = await tauriClient.pickFolderForOrganize().catch(() => null);
                      if (folder) addWatchedFolder(folder);
                    }}
                    className="flex items-center justify-center gap-2 rounded-[11px] border border-border px-3 py-2 text-[12.5px] font-bold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                    <FolderSearch className="h-3.5 w-3.5" />Browse Folder
                  </button>
                </div>

                {/* Paste path + Add */}
                <div className="flex gap-2">
                  <div className="flex h-10 flex-1 items-center gap-2 rounded-[11px] border border-border bg-muted px-3">
                    <FolderOpen className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <input
                      value={newWatchedPath}
                      onChange={(e) => setNewWatchedPath(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && newWatchedPath.trim()) {
                          addWatchedFolder(newWatchedPath.trim());
                          setNewWatchedPath("");
                        }
                      }}
                      placeholder="Paste folder path to watch..."
                      className="flex-1 bg-transparent font-mono text-[12.5px] text-foreground placeholder:text-muted-foreground focus:outline-none"
                    />
                  </div>
                  <button type="button"
                    onClick={() => { if (newWatchedPath.trim()) { addWatchedFolder(newWatchedPath.trim()); setNewWatchedPath(""); } }}
                    disabled={!newWatchedPath.trim()}
                    className="shrink-0 rounded-[11px] px-3.5 py-2 text-[12.5px] font-bold text-white disabled:opacity-40"
                    style={{ background: "var(--primary)" }}>
                    Add
                  </button>
                </div>

                {/* Folder list */}
                <div className="space-y-2">
                  {watchedFolders.length === 0 ? (
                    <div className="rounded-[12px] border-2 border-dashed border-border py-7 text-center">
                      <div className="text-[12.5px] font-bold text-foreground">No watched folders</div>
                      <div className="mt-0.5 text-[11px] text-muted-foreground">Add folders above to start watching</div>
                    </div>
                  ) : (
                    watchedFolders.map((folder) => (
                      <div key={folder} className="flex items-center gap-3 overflow-hidden rounded-[12px] border border-border" style={{ background: "var(--muted)" }}>
                        <div className="w-1 self-stretch shrink-0" style={{ background: "var(--primary)", borderRadius: "12px 0 0 12px" }} />
                        <div className="flex flex-1 items-center gap-2.5 px-2 py-2.5">
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px]" style={{ background: "var(--primary-tint)", color: "var(--primary)" }}>
                            <Eye className="h-3.5 w-3.5" />
                          </div>
                          <span className="flex-1 truncate font-mono text-[12px] text-foreground" title={folder}>{folder}</span>
                          <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold"
                            style={{ background: "var(--success-tint)", color: "var(--success)" }}>
                            Watching
                          </span>
                          <button type="button" onClick={() => removeWatchedFolder(folder)}
                            className="shrink-0 rounded-[7px] p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="border-t border-border" />

              {/* AI Categories */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[10.5px] font-extrabold uppercase tracking-widest text-muted-foreground">AI Categories</div>
                    <div className="mt-0.5 text-[11px] text-muted-foreground">Files are automatically sorted into these categories</div>
                  </div>
                  <div ref={categoryDropdownRef} className="relative flex">
                    <button type="button" onClick={openCatAdd}
                      className="flex items-center gap-1.5 rounded-l-[11px] border border-r-0 border-border px-3.5 py-2 text-[12.5px] font-bold text-white transition-colors"
                      style={{ background: "var(--primary)" }}>
                      <Plus className="h-3.5 w-3.5" />Add Category
                    </button>
                    <button type="button" onClick={() => setCategoryDropdownOpen((p) => !p)}
                      className="flex items-center justify-center rounded-r-[11px] border border-border px-2 py-2"
                      style={{ background: "var(--primary)" }}
                      aria-label="More import options">
                      <ChevronDown className="h-3.5 w-3.5 text-white" />
                    </button>
                    {categoryDropdownOpen && (
                      <div className="absolute right-0 top-full z-10 mt-1 w-52 overflow-hidden rounded-[12px] border border-border bg-card shadow-lg">
                        <button type="button"
                          onClick={() => { setCategoryDropdownOpen(false); void openBatch(); }}
                          className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-[13px] transition-colors hover:bg-muted">
                          <FolderSearch className="h-4 w-4 text-primary" />
                          Import from Folders
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Category list */}
                <div className="space-y-2">
                  {sortedCategories.length === 0 ? (
                    <div className="rounded-[12px] border-2 border-dashed border-border py-8 text-center">
                      <div className="text-[12.5px] font-bold text-foreground">No categories yet</div>
                      <div className="mt-0.5 text-[11px] text-muted-foreground">Click Add Category to get started</div>
                    </div>
                  ) : (
                    sortedCategories.map((category) => {
                      const CatIcon = getCategoryIcon(category.icon);
                      return (
                        <div
                          key={category.id}
                          className={cn(
                            "relative flex items-center gap-0 overflow-hidden rounded-[12px] border border-border transition-colors",
                            !category.enabled && "opacity-60",
                          )}
                          style={{ background: "var(--card)" }}
                        >
                          {/* Left color strip */}
                          <div className="w-1 self-stretch shrink-0" style={{ background: category.color, borderRadius: "12px 0 0 12px" }} />

                          <div className="flex flex-1 items-center gap-3 px-3 py-2.5">
                            {/* Category icon with color tint */}
                            <div
                              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px]"
                              style={{
                                background: withAlpha(category.color, "20"),
                                color: category.color,
                                border: `1px solid ${withAlpha(category.color, "40")}`,
                              }}
                            >
                              <CatIcon className="h-4 w-4" />
                            </div>

                            {/* Content */}
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-[13px] font-extrabold text-foreground">{category.name}</span>
                                {category.isAutoDescription && (
                                  <span className="h-2 w-2 rounded-full bg-amber-400" title="Auto-generated description" />
                                )}
                              </div>
                              {category.description && (
                                <div className="mt-0.5 truncate text-[11px] text-muted-foreground">{category.description}</div>
                              )}
                              {category.folderPath && (
                                <div className="mt-0.5 flex items-center gap-1 text-[10.5px] text-muted-foreground">
                                  <FolderOpen className="h-3 w-3 shrink-0" />
                                  <span className="truncate font-mono">{category.folderPath}</span>
                                </div>
                              )}
                            </div>

                            {/* Right: status + actions */}
                            <div className="flex shrink-0 items-center gap-1.5">
                              <span className="flex items-center gap-1 text-[10px] font-bold"
                                style={{ color: category.aiLearned ? "var(--primary)" : "var(--muted-foreground)" }}>
                                <CheckCircle2 className="h-3 w-3" />
                                {category.aiLearned ? "AI ready" : "Learning"}
                              </span>
                              <button type="button" onClick={() => toggleCategoryEnabled(category)}
                                className="rounded-full px-2 py-0.5 text-[10px] font-bold transition-colors"
                                style={
                                  category.enabled
                                    ? { background: "var(--primary-tint)", color: "var(--primary)" }
                                    : { background: "var(--muted)", color: "var(--muted-foreground)" }
                                }>
                                {category.enabled ? "Enabled" : "Disabled"}
                              </button>
                              <button type="button" onClick={() => openCatEdit(category)}
                                className="rounded-[7px] p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button type="button" onClick={() => deleteCategory(category)}
                                className="rounded-[7px] p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive">
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── Automation ── */}
          {activeTab === "automation" && (
            <div className="space-y-4 p-5">
              {/* Auto Organize */}
              <div className="flex items-center gap-4 rounded-[14px] border border-border p-5" style={{ background: "var(--card)" }}>
                <div
                  className="flex h-[54px] w-[54px] shrink-0 items-center justify-center rounded-[16px] transition-all duration-300"
                  style={
                    isRunning
                      ? { background: "var(--primary)", boxShadow: "0 8px 24px var(--primary-glow)" }
                      : { background: "var(--muted)", border: "1.5px solid var(--border)" }
                  }
                >
                  <Zap className="h-6 w-6" style={{ color: isRunning ? "var(--primary-foreground)" : "var(--muted-foreground)" }} />
                </div>
                <div className="flex-1">
                  <div className="text-[16px] font-extrabold text-foreground">Auto Organize</div>
                  <div className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
                    AI watches your folders and automatically moves files into the right category using confidence scoring
                  </div>
                  <div className="mt-2">
                    <span className="rounded-full px-2.5 py-1 text-[10.5px] font-bold"
                      style={isRunning
                        ? { background: "var(--primary-tint)", color: "var(--primary)" }
                        : { background: "var(--muted)", color: "var(--muted-foreground)" }}>
                      {isRunning ? "● Currently Active" : "○ Disabled"}
                    </span>
                  </div>
                </div>
                <button type="button" onClick={() => setRunning(!isRunning)} role="switch" aria-pressed={isRunning}
                  className={cn("relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors",
                    isRunning ? "bg-primary" : "bg-muted-foreground/30")}>
                  <span className={cn("h-5 w-5 rounded-full bg-white shadow-sm transition-transform", isRunning ? "translate-x-5" : "translate-x-0.5")} />
                </button>
              </div>

              {/* Manual Scan */}
              <div className="flex items-center gap-4 rounded-[14px] border border-border p-5" style={{ background: "var(--card)" }}>
                <div
                  className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-[14px]"
                  style={{ background: "var(--primary)", boxShadow: "0 4px 14px var(--primary-glow)" }}
                >
                  <ScanSearch className="h-5 w-5 text-white" />
                </div>
                <div className="flex-1">
                  <div className="text-[15px] font-extrabold text-foreground">Manual Scan</div>
                  <div className="mt-1 text-[12px] text-muted-foreground">
                    {watchedFolders.length === 0 ? "Add watched folders first" : `Immediately scan ${watchedFolders.length} folder${watchedFolders.length !== 1 ? "s" : ""} and organize unprocessed files`}
                  </div>
                </div>
                <button type="button" onClick={() => void runScanCycle()}
                  disabled={isScanning || watchedFolders.length === 0}
                  className="flex shrink-0 items-center gap-2 rounded-[11px] border border-border px-4 py-2.5 text-[13px] font-bold text-muted-foreground transition-all hover:bg-muted hover:text-foreground disabled:opacity-50"
                  style={{ boxShadow: "var(--shadow-xs)" }}>
                  {isScanning ? <><RefreshCw className="h-3.5 w-3.5 animate-spin" />Scanning...</> : <><ScanSearch className="h-3.5 w-3.5" />Scan Now</>}
                </button>
              </div>

              {/* Watcher Status */}
              <div className="rounded-[14px] border border-border p-5 space-y-4" style={{ background: "var(--card)" }}>
                <div className="flex items-center justify-between">
                  <div className="text-[10.5px] font-extrabold uppercase tracking-widest text-muted-foreground">Watcher Status</div>
                  <button type="button" onClick={() => void refreshWatcherFileCounts()} disabled={isCountingWatcherFiles}
                    className="text-[11px] font-bold text-primary transition-colors hover:opacity-70 disabled:opacity-50">
                    {isCountingWatcherFiles ? "Refreshing..." : "Refresh"}
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2.5">
                  {[
                    { value: watchedFolders.length.toString(), label: "Folder", sub: "Watched" },
                    { value: totalWatchedFiles.toString(), label: "Files", sub: "Monitored" },
                    { value: isRunning ? "Active" : "Paused", label: "Status", sub: isRunning ? "Running" : "Stopped" },
                  ].map((stat) => (
                    <div key={stat.label} className="rounded-[12px] border border-border px-3 py-3 text-center" style={{ background: "var(--muted)" }}>
                      <div className="text-[22px] font-extrabold leading-none" style={{ letterSpacing: "-0.5px", color: "var(--foreground)" }}>{stat.value}</div>
                      <div className="mt-1.5 text-[10.5px] text-muted-foreground">{stat.label} {stat.sub}</div>
                    </div>
                  ))}
                </div>
                {watchedFolders.length === 0 ? (
                  <div className="rounded-[10px] border border-dashed border-border px-4 py-4 text-center text-[12px] text-muted-foreground">No watched folders configured</div>
                ) : (
                  <div className="space-y-2">
                    {watchedFolders.map((folderPath) => {
                      const stat = watcherFolderStats.find((s) => s.folderPath === folderPath);
                      return (
                        <div key={folderPath} className="flex items-center justify-between rounded-[11px] border border-border px-3 py-2.5" style={{ background: "var(--muted)" }}>
                          <div className="flex min-w-0 items-center gap-2.5">
                            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: isRunning ? "var(--success)" : "var(--muted-foreground)" }} />
                            <span className="truncate font-mono text-[12px] text-foreground" title={folderPath}>{folderPath}</span>
                          </div>
                          {stat && (
                            <span className="ml-3 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold"
                              style={{ background: "var(--primary-tint)", color: "var(--primary)" }}>
                              {stat.fileCount} file{stat.fileCount !== 1 ? "s" : ""}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Security ── */}
          {activeTab === "security" && (
            <div className="overflow-hidden rounded-[18px]">
              <div className="flex items-center gap-3 px-5 py-4" style={{ background: "var(--primary)", minHeight: 70 }}>
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px]" style={{ background: "rgba(255,255,255,0.15)" }}>
                  <ShieldCheck className="h-5 w-5 text-white" />
                </div>
                <div className="flex-1">
                  <div className="text-[14px] font-extrabold text-white">Security Vault</div>
                  <div className="text-[11px] text-white/60">Paths locked here are never sent to AI</div>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => void handleLockFiles()}
                    className="flex items-center gap-1.5 rounded-[9px] px-3 py-1.5 text-[12px] font-bold"
                    style={{ background: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.9)" }}>
                    <FileX2 className="h-3.5 w-3.5" />Lock File
                  </button>
                  <button type="button" onClick={() => void handleLockFolder()}
                    className="flex items-center gap-1.5 rounded-[9px] px-3 py-1.5 text-[12px] font-bold"
                    style={{ background: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.9)" }}>
                    <FolderLock className="h-3.5 w-3.5" />Lock Folder
                  </button>
                </div>
              </div>
              <div className="space-y-3 p-5">
                <div className="flex w-fit items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-bold"
                  style={{ background: "var(--purple-soft)", color: "var(--purple)" }}>
                  <ShieldCheck className="h-3.5 w-3.5" />
                  {lockedPaths.length} locked path{lockedPaths.length !== 1 ? "s" : ""} — blocked from AI
                </div>
                {lockedPaths.length === 0 ? (
                  <div className="flex flex-col items-center gap-3 rounded-[14px] border-2 border-dashed border-border py-10 text-center" style={{ background: "var(--muted)" }}>
                    <div className="flex h-[54px] w-[54px] items-center justify-center rounded-[16px]" style={{ background: "var(--primary)", boxShadow: "0 6px 20px var(--primary-glow)" }}>
                      <LockOpen className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <div className="text-[14px] font-extrabold text-foreground">No paths locked</div>
                      <div className="mt-1 text-[12px] text-muted-foreground">All files are accessible to AI. Lock sensitive paths to protect them.</div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {lockedPaths.map((p) => (
                      <div key={p} className="flex items-center gap-3 rounded-[12px] border px-3 py-3"
                        style={{ background: "rgba(239,68,68,0.05)", borderColor: "rgba(239,68,68,0.18)" }}>
                        <div className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[9px]" style={{ background: "rgba(239,68,68,0.1)" }}>
                          <Lock className="h-3.5 w-3.5" style={{ color: "var(--destructive)" }} />
                        </div>
                        <span className="flex-1 truncate font-mono text-[12px] text-foreground" title={p}>{p}</span>
                        <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: "rgba(239,68,68,0.1)", color: "var(--destructive)" }}>Locked</span>
                        <button type="button" onClick={() => unlockPath(p)}
                          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[7px] transition-colors hover:bg-destructive/10"
                          style={{ background: "rgba(239,68,68,0.08)" }}>
                          <X className="h-3.5 w-3.5" style={{ color: "var(--destructive)" }} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Developer (DEV only) ── */}
          {activeTab === "developer" && import.meta.env.DEV && (
            <div className="space-y-4 p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-[10px]" style={{ background: "var(--primary)" }}>
                    <Terminal className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <div className="text-[13px] font-extrabold text-foreground">Developer Debug</div>
                    <div className="text-[11px] text-muted-foreground">Server health and local model slots</div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => void checkFastApiHealth(true)} disabled={isRefreshingDevHealth}
                    className="flex items-center gap-1.5 rounded-[9px] border border-border px-3 py-1.5 text-[11.5px] font-bold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50">
                    <RefreshCw className={cn("h-3 w-3", isRefreshingDevHealth && "animate-spin")} />Refresh
                  </button>
                  <button type="button" onClick={() => navigate("/settings/api-logs")}
                    className="flex items-center gap-1.5 rounded-[9px] px-3 py-1.5 text-[11.5px] font-bold text-white transition-colors"
                    style={{ background: "var(--primary)" }}>
                    <Activity className="h-3 w-3" />API Logs
                  </button>
                </div>
              </div>
              <div className="grid gap-2.5 md:grid-cols-2">
                <div className="flex items-center justify-between rounded-[12px] border border-border bg-card px-3.5 py-3">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-[9px]" style={{ background: "var(--primary-tint)", color: "var(--primary)" }}>
                      <Server className="h-3.5 w-3.5" />
                    </div>
                    <span className="text-[12.5px] font-semibold text-foreground">FastAPI Backend</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full"
                      style={fastApiStatus === "checking" ? { background: "var(--muted-foreground)", animation: "pulse 1s infinite" } : fastApiStatus === "online" ? { background: "var(--success)" } : { background: "var(--destructive)" }}
                    />
                    <span className="text-[10.5px] font-bold uppercase tracking-wider"
                      style={fastApiStatus === "online" ? { color: "var(--success)" } : fastApiStatus === "offline" ? { color: "var(--destructive)" } : { color: "var(--muted-foreground)" }}>
                      {fastApiStatus}
                    </span>
                  </div>
                </div>
                {slotConfigs.map(({ key, label, port }) => (
                  <div key={key} className="flex items-center justify-between rounded-[12px] border border-border bg-card px-3.5 py-3">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px]" style={{ background: "var(--primary-tint)", color: "var(--primary)" }}>
                        <Server className="h-3.5 w-3.5" />
                      </div>
                      <div className="min-w-0">
                        <span className="truncate text-[12.5px] font-semibold text-foreground">{label}</span>
                        <span className="ml-1.5 font-mono text-[10px] text-muted-foreground">:{port}</span>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {slotHealth[key] && <span className="font-mono text-[10px] text-muted-foreground">{slotHealth[key]}</span>}
                      <Button variant="outline" size="sm" className="h-6 gap-1 px-2 text-[11px]" onClick={() => void checkSlotHealth(key, port)}>
                        <Activity className="h-2.5 w-2.5" />
                      </Button>
                      <Button variant="outline" size="sm" className="h-6 gap-1 px-2 text-[11px]" onClick={() => void handleStartSlot(key)} disabled={startingSlot === key}>
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
      </div>

      {/* Category editor modal */}
      {catEditorMode && (
        <CategoryEditorModal
          mode={catEditorMode}
          formState={catFormState}
          onFormChange={setCatFormState}
          onClose={closeCatEditor}
          onSave={handleSaveCategory}
          saveError={catSaveError}
          isSaving={isSavingCategory}
          defaultFolder={defaultFolder}
        />
      )}

      {/* Batch import modal */}
      {showBatchModal && (
        <BatchCategoryModal
          initialFolders={batchInitialFolders}
          onClose={() => {
            setShowBatchModal(false);
            setBatchInitialFolders([]);
            void categoryManagementService.refreshCategoriesFromWorker().then(() => categoryManagementService.syncToAutomationStores());
          }}
        />
      )}

    </div>
  );
}
