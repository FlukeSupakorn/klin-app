import { useEffect, useMemo, useState } from "react";
import { Plus, Pencil, FolderOpen, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { categoryManagementService } from "@/services/category-management-service";
import { useCategoryManagementStore } from "@/stores/use-category-management-store";
import type { ManagedCategory } from "@/types/domain";

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

export function SettingsPage() {
  const defaultFolder = useCategoryManagementStore((state) => state.defaultFolder);
  const categories = useCategoryManagementStore((state) => state.categories);
  const setDefaultFolder = useCategoryManagementStore((state) => state.setDefaultFolder);
  const addCategory = useCategoryManagementStore((state) => state.addCategory);
  const updateCategory = useCategoryManagementStore((state) => state.updateCategory);

  const [draftDefaultFolder, setDraftDefaultFolder] = useState(defaultFolder);
  const [modalMode, setModalMode] = useState<ModalMode | null>(null);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [formState, setFormState] = useState<CategoryFormState>(emptyForm);

  const enabledCount = useMemo(() => categories.filter((category) => category.enabled).length, [categories]);

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

  const closeModal = () => {
    setModalMode(null);
    setEditingCategoryId(null);
    setFormState(emptyForm);
  };

  const handleSave = () => {
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
    closeModal();
  };

  return (
    <div className="space-y-6 pb-10">
      <div>
        <h2 className="text-3xl font-semibold tracking-tight">Category Management</h2>
        <p className="text-muted-foreground">Manage categories, descriptions, and destination folders used by automation.</p>
      </div>

      <Card className="border-0 bg-muted/40 shadow-none">
        <CardHeader>
          <CardTitle className="text-lg">Default Folder</CardTitle>
          <CardDescription>
            Category folders are created and resolved under this base path.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 md:flex-row md:items-center">
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
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Categories</CardTitle>
            <CardDescription>
              Edit category name, description, and folder destination path.
            </CardDescription>
          </div>
          <Button className="gap-2" onClick={openAddModal}>
            <Plus className="h-4 w-4" /> Add New Category
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
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
        </CardContent>
      </Card>

      {modalMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/30 p-4">
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
                <Button variant="ghost" onClick={closeModal}>Cancel</Button>
                <Button onClick={handleSave}>{modalMode === "edit" ? "Save Changes" : "Add Category"}</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
