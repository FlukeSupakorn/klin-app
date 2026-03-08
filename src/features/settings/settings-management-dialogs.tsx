import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, ChevronDown, FolderOpen, FolderPlus, FolderSearch, Pencil, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { categoryManagementService } from "@/services/category-management-service";
import { tauriClient } from "@/services/tauri-client";
import { useCategoryManagementStore } from "@/stores/use-category-management-store";
import { useAutomationStore } from "@/stores/use-automation-store";
import { cn } from "@/lib/utils";
import { BatchCategoryModal } from "@/features/categories/batch-category-modal";
import type { ManagedCategory } from "@/types/domain";

function joinDefaultFolderPath(basePath: string, categoryName: string): string {
  const normalizedBase = basePath.trim().replace(/[\\/]+$/, "");
  const normalizedName = categoryName.trim();
  return normalizedBase ? `${normalizedBase}/${normalizedName}` : normalizedName;
}

export type SettingsDialogSection = "default-folder" | "watched-folders" | "categories";

type ModalMode = "edit" | "add";

interface CategoryFormState {
  name: string;
  description: string;
  color: string;
  folderPath: string;
  enabled: boolean;
  aiLearned: boolean;
}

const emptyForm: CategoryFormState = {
  name: "",
  description: "",
  color: "#6366f1",
  folderPath: "",
  enabled: true,
  aiLearned: true,
};

interface SettingsManagementDialogsProps {
  open: boolean;
  sections: SettingsDialogSection[];
  onClose: () => void;
}

export function SettingsManagementDialogs({ open, sections, onClose }: SettingsManagementDialogsProps) {
  const defaultFolder = useCategoryManagementStore((state) => state.defaultFolder);
  const categories = useCategoryManagementStore((state) => state.categories);
  const watchedFolders = useAutomationStore((state) => state.watchedFolders);
  const addWatchedFolder = useAutomationStore((state) => state.addWatchedFolder);
  const removeWatchedFolder = useAutomationStore((state) => state.removeWatchedFolder);

  const [draftDefaultFolder, setDraftDefaultFolder] = useState(defaultFolder);
  const [isSavingDefaultFolder, setIsSavingDefaultFolder] = useState(false);
  const [defaultFolderError, setDefaultFolderError] = useState<string | null>(null);
  const [newWatchedFolderPath, setNewWatchedFolderPath] = useState("");
  const [modalMode, setModalMode] = useState<ModalMode | null>(null);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [formState, setFormState] = useState<CategoryFormState>(emptyForm);

  const [showDropdown, setShowDropdown] = useState(false);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [batchInitialFolders, setBatchInitialFolders] = useState<string[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const enabledCount = useMemo(() => categories.filter((category) => category.enabled).length, [categories]);
  const sortedCategories = useMemo(() => {
    return [...categories].sort((left, right) => {
      if (left.enabled !== right.enabled) {
        return left.enabled ? -1 : 1;
      }

      return left.name.localeCompare(right.name, undefined, { sensitivity: "base" });
    });
  }, [categories]);
  const showDefaultFolder = sections.includes("default-folder");
  const showWatchedFolders = sections.includes("watched-folders");
  const showCategories = sections.includes("categories");

  useEffect(() => {
    setDraftDefaultFolder(defaultFolder);
  }, [defaultFolder]);

  useEffect(() => {
    if (!open) {
      return;
    }

    void categoryManagementService.refreshCategoriesFromWorker().then(() => {
      categoryManagementService.syncToAutomationStores();
    });
  }, [open]);

  const persistDefaultFolder = async (path: string) => {
    const normalized = path.trim();
    if (!normalized) {
      return;
    }

    setIsSavingDefaultFolder(true);
    setDefaultFolderError(null);

    try {
      await categoryManagementService.saveDefaultFolder(normalized);
      categoryManagementService.syncToAutomationStores();
      setDraftDefaultFolder(normalized);
    } catch (error) {
      setDefaultFolderError(error instanceof Error ? error.message : "Failed to save default folder");
    } finally {
      setIsSavingDefaultFolder(false);
    }
  };

  const browseAndSaveDefaultFolder = async () => {
    const selectedFolder = await tauriClient.pickFolderForOrganize().catch(() => null);
    if (!selectedFolder) {
      return;
    }

    await persistDefaultFolder(selectedFolder);
  };

  const openEditModal = (category: ManagedCategory) => {
    setModalMode("edit");
    setEditingCategoryId(category.id);
    setFormState({
      name: category.name,
      description: category.description,
      color: category.color,
      folderPath: category.folderPath,
      enabled: category.enabled,
      aiLearned: category.aiLearned,
    });
  };

  const openBatchModal = async () => {
    setShowDropdown(false);
    const picked = await tauriClient.pickFoldersForBatch().catch(() => [] as string[]);
    if (!picked.length) return;
    setBatchInitialFolders(picked);
    setShowBatchModal(true);
  };

  const openAddModal = () => {
    setModalMode("add");
    setEditingCategoryId(null);
    setFormState({
      ...emptyForm,
      folderPath: joinDefaultFolderPath(defaultFolder, "New Category"),
    });
  };

  const closeCategoryEditor = () => {
    setModalMode(null);
    setEditingCategoryId(null);
    setFormState(emptyForm);
  };

  const toggleCategoryEnabled = (category: ManagedCategory) => {
    void categoryManagementService
      .updateCategoryInWorker(category.id, { enabled: !category.enabled })
      .then(() => {
        categoryManagementService.syncToAutomationStores();
      });
  };

  const handleDeleteCategory = (category: ManagedCategory) => {
    void categoryManagementService
      .deleteCategoryInWorker(category.id)
      .then(() => {
        categoryManagementService.syncToAutomationStores();
      });
  };

  const handleSaveCategory = async () => {
    if (!formState.name.trim() || !formState.description.trim()) {
      return;
    }

    const normalizedName = formState.name.trim();
    const normalizedDescription = formState.description.trim();
    const normalizedFolderPath = formState.folderPath.trim() || joinDefaultFolderPath(defaultFolder, normalizedName);

    if (modalMode === "edit" && editingCategoryId) {
      await categoryManagementService.updateCategoryInWorker(editingCategoryId, {
        name: normalizedName,
        description: normalizedDescription,
        color: formState.color,
        folderPath: normalizedFolderPath,
        enabled: formState.enabled,
        aiLearned: formState.aiLearned,
      });
    }

    if (modalMode === "add") {
      await categoryManagementService.addCategoryToWorker({
        name: normalizedName,
        description: normalizedDescription,
        color: formState.color,
        folderPath: normalizedFolderPath,
        enabled: formState.enabled,
        aiLearned: formState.aiLearned,
      });
    }

    categoryManagementService.syncToAutomationStores();
    closeCategoryEditor();
  };

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
        <div className="flex w-full max-w-2xl flex-col rounded-2xl border border-border bg-card shadow-2xl" style={{ maxHeight: "85vh" }}>
          <div className="flex flex-shrink-0 items-center justify-between border-b border-border px-6 py-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Configuration</p>
              <h2 className="font-syne text-xl font-black uppercase tracking-tight">Manage Settings</h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto p-6">
            {showDefaultFolder && (
              <div className="space-y-3 rounded-lg border border-border bg-background p-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Default</p>
                  <h3 className="font-black">Default Folder</h3>
                </div>
                <div className="flex gap-2">
                  <Input
                    value={draftDefaultFolder}
                    onChange={(event) => setDraftDefaultFolder(event.target.value)}
                    placeholder="Base path for categories"
                    className="border-border bg-muted"
                  />
                  <Button
                    variant="outline"
                    onClick={() => void browseAndSaveDefaultFolder()}
                    disabled={isSavingDefaultFolder}
                  >
                    Browse Folder
                  </Button>
                  <Button
                    onClick={() => {
                      if (!draftDefaultFolder.trim()) return;
                      void persistDefaultFolder(draftDefaultFolder.trim());
                    }}
                    disabled={isSavingDefaultFolder}
                  >
                    {isSavingDefaultFolder ? "Saving..." : "Save"}
                  </Button>
                </div>
                {defaultFolderError && (
                  <p className="text-xs text-destructive">{defaultFolderError}</p>
                )}
                <p className="text-xs text-muted-foreground">{enabledCount} categor{enabledCount !== 1 ? "ies" : "y"} enabled</p>
              </div>
            )}

            {showWatchedFolders && (
              <div className="space-y-3 rounded-lg border border-border bg-background p-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Monitoring</p>
                  <h3 className="font-black">Watched Folders</h3>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Button
                    variant="outline"
                    className="justify-start gap-2"
                    onClick={async () => addWatchedFolder(await tauriClient.getDownloadsFolder())}
                  >
                    <FolderPlus className="h-4 w-4" /> Add Downloads
                  </Button>
                  <Button
                    variant="outline"
                    className="justify-start gap-2"
                    onClick={async () => {
                      const folder = await tauriClient.pickFolderForOrganize().catch(() => null);
                      if (folder) addWatchedFolder(folder);
                    }}
                  >
                    <FolderPlus className="h-4 w-4" /> Browse Folder
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Input
                    value={newWatchedFolderPath}
                    onChange={(event) => setNewWatchedFolderPath(event.target.value)}
                    placeholder="Paste folder path"
                    className="border-border bg-muted"
                  />
                  <Button
                    onClick={() => {
                      if (!newWatchedFolderPath.trim()) return;
                      addWatchedFolder(newWatchedFolderPath.trim());
                      setNewWatchedFolderPath("");
                    }}
                  >
                    Add
                  </Button>
                </div>
                <div className="space-y-2">
                  {watchedFolders.length === 0 ? (
                    <div className="rounded-lg border-2 border-dashed border-border py-8 text-center text-sm text-muted-foreground">
                      No folders being watched yet.
                    </div>
                  ) : (
                    watchedFolders.map((folder) => (
                      <div key={folder} className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2.5">
                        <div className="flex min-w-0 items-center gap-3">
                          <FolderSearch className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                          <p className="truncate font-mono text-sm">{folder}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeWatchedFolder(folder)}
                          className="ml-3 flex-shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {showCategories && (
              <div className="space-y-3 rounded-lg border border-border bg-background p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">AI Classification</p>
                    <h3 className="font-black">Categories</h3>
                  </div>
                  <div ref={dropdownRef} className="relative flex">
                    <Button
                      className="h-8 gap-2 rounded-r-none border-r border-primary/30 text-xs"
                      onClick={openAddModal}
                    >
                      <Plus className="h-3.5 w-3.5" /> Add Category
                    </Button>
                    <Button
                      className="h-8 w-7 rounded-l-none px-1.5 text-xs"
                      onClick={() => setShowDropdown((prev) => !prev)}
                      aria-label="More import options"
                    >
                      <ChevronDown className="h-3.5 w-3.5" />
                    </Button>
                    {showDropdown && (
                      <div className="absolute right-0 top-full z-10 mt-1 w-52 overflow-hidden rounded-xl border border-border bg-card shadow-lg">
                        <button
                          type="button"
                          onClick={() => void openBatchModal()}
                          className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm transition-colors hover:bg-accent/60"
                        >
                          <FolderSearch className="h-4 w-4 text-primary" />
                          Import from Folders
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  {sortedCategories.map((category) => (
                    <div
                      key={category.id}
                      className={cn(
                        "relative rounded-lg border border-border p-3 transition-colors",
                        category.enabled ? "bg-muted/30" : "bg-muted/10 opacity-60",
                      )}
                    >
                      {category.isAutoDescription && (
                        <span
                          className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-amber-400"
                          title="Description auto-generated from folder path — edit to customize"
                        />
                      )}
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span
                              className="inline-block h-3 w-3 rounded-full border border-border"
                              style={{ backgroundColor: category.color }}
                              title={category.color}
                            />
                            <span className="text-sm font-black">{category.name}</span>
                            <button
                              type="button"
                              onClick={() => toggleCategoryEnabled(category)}
                              className={cn(
                                "rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-widest transition-colors",
                                category.enabled ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
                              )}
                            >
                              {category.enabled ? "Enabled" : "Disabled"}
                            </button>
                          </div>
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">{category.description}</p>
                          <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                            <FolderOpen className="h-3 w-3" />
                            <span className="truncate font-mono">{category.folderPath}</span>
                          </div>
                        </div>
                        <div className="flex flex-shrink-0 items-center gap-2">
                          <span className={cn(
                            "flex items-center gap-1 text-[10px] font-black uppercase tracking-widest",
                            category.aiLearned ? "text-primary" : "text-muted-foreground",
                          )}>
                            <CheckCircle2 className="h-3 w-3" />
                            {category.aiLearned ? "AI ready" : "Learning"}
                          </span>
                          <button
                            type="button"
                            onClick={() => openEditModal(category)}
                            className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteCategory(category)}
                            className="rounded p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {showBatchModal && (
        <BatchCategoryModal
          initialFolders={batchInitialFolders}
          onClose={() => {
            setShowBatchModal(false);
            setBatchInitialFolders([]);
            void categoryManagementService.refreshCategoriesFromWorker().then(() => {
              categoryManagementService.syncToAutomationStores();
            });
          }}
        />
      )}

      {modalMode && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-border bg-card shadow-2xl">
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Category</p>
                <h2 className="font-syne text-lg font-black uppercase tracking-tight">
                  {modalMode === "edit" ? "Edit Category" : "Add Category"}
                </h2>
              </div>
              <button
                type="button"
                onClick={closeCategoryEditor}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-4 p-6">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Name</label>
                <Input
                  value={formState.name}
                  onChange={(event) => setFormState((state) => ({ ...state, name: event.target.value }))}
                  className="border-border bg-muted"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Description</label>
                <textarea
                  value={formState.description}
                  onChange={(event) => setFormState((state) => ({ ...state, description: event.target.value }))}
                  className="min-h-[100px] w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground focus:outline-none"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={formState.color}
                    onChange={(event) => setFormState((state) => ({ ...state, color: event.target.value }))}
                    className="h-9 w-12 cursor-pointer rounded border border-border bg-muted p-1"
                  />
                  <Input
                    value={formState.color}
                    onChange={(event) => setFormState((state) => ({ ...state, color: event.target.value }))}
                    className="border-border bg-muted font-mono"
                    placeholder="#6366f1"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Folder Path</label>
                <Input
                  value={formState.folderPath}
                  onChange={(event) => setFormState((state) => ({ ...state, folderPath: event.target.value }))}
                  className="border-border bg-muted"
                />
                <p className="font-mono text-[11px] text-primary">{formState.folderPath}</p>
              </div>
              <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2.5 text-xs">
                <CheckCircle2 className={cn("h-3.5 w-3.5", formState.aiLearned ? "text-primary" : "text-muted-foreground")} />
                <span className={formState.aiLearned ? "text-foreground" : "text-muted-foreground"}>
                  {formState.aiLearned ? "AI learned" : "AI learning"}
                </span>
              </div>
              <div className="flex justify-between pt-1">
                <Button variant="outline" onClick={closeCategoryEditor}>Cancel</Button>
                <Button onClick={() => void handleSaveCategory()}>
                  {modalMode === "edit" ? "Save Changes" : "Add Category"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
