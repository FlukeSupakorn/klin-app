import { useEffect, useMemo, useState } from "react";
import { Plus, Pencil, FolderOpen, CheckCircle2, FolderSearch, Trash2, FolderPlus } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { categoryManagementService } from "@/services/category-management-service";
import { tauriClient } from "@/services/tauri-client";
import { useCategoryManagementStore } from "@/stores/use-category-management-store";
import { useAutomationStore } from "@/stores/use-automation-store";
import type { ManagedCategory } from "@/types/domain";

export type SettingsDialogSection = "default-folder" | "watched-folders" | "categories";

type ModalMode = "edit" | "add";

interface CategoryFormState {
  name: string;
  description: string;
  folderPath: string;
  enabled: boolean;
  aiLearned: boolean;
}

const emptyForm: CategoryFormState = {
  name: "",
  description: "",
  folderPath: "",
  enabled: true,
  aiLearned: true,
};

interface SettingsManagementDialogsProps {
  open: boolean;
  sections: SettingsDialogSection[];
  title?: string;
  description?: string;
  onClose: () => void;
}

export function SettingsManagementDialogs({
  open,
  sections,
  title = "Settings Management",
  description = "Manage default folder, watched folders, and categories in one window.",
  onClose,
}: SettingsManagementDialogsProps) {
  const defaultFolder = useCategoryManagementStore((state) => state.defaultFolder);
  const categories = useCategoryManagementStore((state) => state.categories);
  const setDefaultFolder = useCategoryManagementStore((state) => state.setDefaultFolder);
  const addCategory = useCategoryManagementStore((state) => state.addCategory);
  const updateCategory = useCategoryManagementStore((state) => state.updateCategory);
  const watchedFolders = useAutomationStore((state) => state.watchedFolders);
  const addWatchedFolder = useAutomationStore((state) => state.addWatchedFolder);
  const removeWatchedFolder = useAutomationStore((state) => state.removeWatchedFolder);

  const [draftDefaultFolder, setDraftDefaultFolder] = useState(defaultFolder);
  const [newWatchedFolderPath, setNewWatchedFolderPath] = useState("");
  const [modalMode, setModalMode] = useState<ModalMode | null>(null);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [formState, setFormState] = useState<CategoryFormState>(emptyForm);

  const enabledCount = useMemo(() => categories.filter((category) => category.enabled).length, [categories]);
  const showDefaultFolder = sections.includes("default-folder");
  const showWatchedFolders = sections.includes("watched-folders");
  const showCategories = sections.includes("categories");

  useEffect(() => {
    setDraftDefaultFolder(defaultFolder);
  }, [defaultFolder]);

  const openEditModal = (category: ManagedCategory) => {
    setModalMode("edit");
    setEditingCategoryId(category.id);
    setFormState({
      name: category.name,
      description: category.description,
      folderPath: category.folderPath,
      enabled: category.enabled,
      aiLearned: category.aiLearned,
    });
  };

  const openAddModal = () => {
    setModalMode("add");
    setEditingCategoryId(null);
    setFormState({
      ...emptyForm,
      folderPath: `${defaultFolder}/New Category`,
    });
  };

  const closeCategoryEditor = () => {
    setModalMode(null);
    setEditingCategoryId(null);
    setFormState(emptyForm);
  };

  const handleSaveCategory = () => {
    if (!formState.name.trim() || !formState.description.trim() || !formState.folderPath.trim()) {
      return;
    }

    if (modalMode === "edit" && editingCategoryId) {
      updateCategory(editingCategoryId, {
        name: formState.name.trim(),
        description: formState.description.trim(),
        folderPath: formState.folderPath.trim(),
        enabled: formState.enabled,
        aiLearned: formState.aiLearned,
      });
    }

    if (modalMode === "add") {
      addCategory({
        name: formState.name.trim(),
        description: formState.description.trim(),
        folderPath: formState.folderPath.trim(),
        enabled: formState.enabled,
        aiLearned: formState.aiLearned,
      });
    }

    categoryManagementService.syncToAutomationStores();
    closeCategoryEditor();
  };

  if (!open) {
    return null;
  }

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/30 p-4">
        <Card className="w-full max-w-5xl">
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle className="text-xl">{title}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </div>
            <Button variant="outline" onClick={onClose}>Close</Button>
          </CardHeader>

          <CardContent className="max-h-[70vh] space-y-6 overflow-y-auto pr-1">
            {showDefaultFolder && (
              <div className="rounded-2xl border border-border/60 p-4">
                <h3 className="text-sm font-semibold">Default Folder</h3>
                <p className="mb-3 text-xs text-muted-foreground">Category folders are created and resolved under this base path.</p>
                <div className="flex flex-col gap-3 md:flex-row md:items-center">
                  <Input
                    value={draftDefaultFolder}
                    onChange={(event) => setDraftDefaultFolder(event.target.value)}
                    className="bg-background"
                  />
                  <Button
                    onClick={() => {
                      if (!draftDefaultFolder.trim()) {
                        return;
                      }
                      setDefaultFolder(draftDefaultFolder.trim());
                      categoryManagementService.syncToAutomationStores();
                    }}
                  >
                    Change
                  </Button>
                  <Badge variant="secondary">{enabledCount} enabled</Badge>
                </div>
              </div>
            )}

            {showWatchedFolders && (
              <div className="rounded-2xl border border-border/60 p-4">
                <h3 className="text-sm font-semibold">Watched Folders</h3>
                <p className="mb-3 text-xs text-muted-foreground">The automation engine monitors these locations for new files.</p>

                <div className="mb-3 grid gap-2 sm:grid-cols-2">
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
                    onClick={() => addWatchedFolder("C:/Users/User/Desktop")}
                  >
                    <FolderPlus className="h-4 w-4" /> Add Desktop
                  </Button>
                </div>

                <div className="mb-3 flex gap-2">
                  <Input
                    value={newWatchedFolderPath}
                    onChange={(event) => setNewWatchedFolderPath(event.target.value)}
                    placeholder="Enter folder path manually..."
                    className="bg-muted/30"
                  />
                  <Button
                    onClick={() => {
                      if (!newWatchedFolderPath.trim()) {
                        return;
                      }
                      addWatchedFolder(newWatchedFolderPath.trim());
                      setNewWatchedFolderPath("");
                    }}
                  >
                    Add Path
                  </Button>
                </div>

                <div className="space-y-3 max-h-[30vh] overflow-y-auto pr-1">
                  {watchedFolders.length === 0 ? (
                    <div className="rounded-2xl border-2 border-dashed py-10 text-center text-muted-foreground">
                      No folders being watched yet.
                    </div>
                  ) : (
                    watchedFolders.map((folder) => (
                      <div key={folder} className="flex items-center justify-between rounded-xl border border-border/60 p-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                            <FolderSearch className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="font-mono text-sm font-medium">{folder}</p>
                            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Active Watch</p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeWatchedFolder(folder)}
                          className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {showCategories && (
              <div className="rounded-2xl border border-border/60 p-4">
                <div className="mb-3 flex items-center justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-semibold">Categories</h3>
                    <p className="text-xs text-muted-foreground">Edit category name, description, and folder destination path.</p>
                  </div>
                  <Button className="gap-2" onClick={openAddModal}>
                    <Plus className="h-4 w-4" /> Add New Category
                  </Button>
                </div>

                <div className="space-y-2">
                  {categories.map((category) => (
                    <div key={category.id} className="rounded-xl border border-border/60 p-4">
                      <div className="mb-2 flex items-start justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold">{category.name}</h3>
                            <Badge variant={category.enabled ? "default" : "outline"}>{category.enabled ? "Enabled" : "Disabled"}</Badge>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">{category.description}</p>
                        </div>
                        <Button variant="outline" size="sm" className="gap-2" onClick={() => openEditModal(category)}>
                          <Pencil className="h-3 w-3" /> Edit
                        </Button>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-primary">
                        <FolderOpen className="h-3 w-3" /> {category.folderPath}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {modalMode && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-foreground/30 p-4">
          <Card className="w-full max-w-2xl">
            <CardHeader>
              <CardTitle>{modalMode === "edit" ? "Edit Category" : "Add New Category"}</CardTitle>
              <CardDescription>
                {modalMode === "edit"
                  ? "Update category details to keep AI recommendations accurate."
                  : "Create a custom category for organizing your files."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-bold uppercase text-muted-foreground">Category Name</label>
                <Input
                  value={formState.name}
                  onChange={(event) => setFormState((state) => ({ ...state, name: event.target.value }))}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold uppercase text-muted-foreground">Description</label>
                <textarea
                  value={formState.description}
                  onChange={(event) => setFormState((state) => ({ ...state, description: event.target.value }))}
                  className="min-h-[120px] w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold uppercase text-muted-foreground">Folder Path</label>
                <Input
                  value={formState.folderPath}
                  onChange={(event) => setFormState((state) => ({ ...state, folderPath: event.target.value }))}
                />
                <p className="mt-1 text-xs text-primary">Resolved path: {formState.folderPath}</p>
              </div>
              <div className="flex items-center gap-3 rounded-lg bg-muted/40 p-3 text-sm">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                Ready - AI knows this category and can classify files into it.
              </div>
              <div className="flex justify-between pt-2">
                <Button variant="ghost" onClick={closeCategoryEditor}>Cancel</Button>
                <Button onClick={handleSaveCategory}>{modalMode === "edit" ? "Save Changes" : "Add Category"}</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}
