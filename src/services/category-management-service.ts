import { useCategoryManagementStore } from "@/stores/use-category-management-store";
import { useCategoryStore } from "@/stores/use-category-store";
import { useRuleStore } from "@/stores/use-rule-store";
import { tauriClient } from "@/services/tauri-client";
import { withLlama } from "@/hooks/useLlama";
import type { ManagedCategory } from "@/types/domain";

const SETTINGS_API_URL_CANDIDATES = [
  "http://127.0.0.1:8000/api/settings",
  "http://localhost:8000/api/settings",
];

const CATEGORIES_API_URL_CANDIDATES = [
  "http://127.0.0.1:8000/api/settings/categories",
  "http://localhost:8000/api/settings/categories",
  "http://127.0.0.1:8000/api/categories",
  "http://localhost:8000/api/categories",
];

interface WorkerCategory {
  id: string;
  name: string;
  description: string;
  color?: string | null;
  folder_path?: string | null;
  destination_path?: string | null;
  enabled?: boolean;
  is_active?: boolean;
  learning?: boolean | number | null;
  is_auto_description?: boolean;
}

interface WorkerDefaultBasePathResponse {
  default_base_path: string | null;
}

export interface CategoryManagementRepository {
  getDefaultFolder(): string;
  setManagementState(defaultFolder: string, categories: ManagedCategory[]): void;
  listCategories(): ManagedCategory[];
}

class ZustandCategoryManagementRepository implements CategoryManagementRepository {
  getDefaultFolder() {
    return useCategoryManagementStore.getState().defaultFolder;
  }

  setManagementState(defaultFolder: string, categories: ManagedCategory[]) {
    useCategoryManagementStore.getState().setManagementState(defaultFolder, categories);
  }

  listCategories() {
    return useCategoryManagementStore.getState().categories;
  }
}

function ensureSuccess(response: Response, label: string): Response {
  if (!response.ok) {
    throw new Error(`${label}: ${response.status}`);
  }

  return response;
}

function joinFolderPath(basePath: string, categoryName: string): string {
  const normalized = basePath.trim().replace(/[\\/]+$/, "");
  return normalized ? `${normalized}/${categoryName}` : categoryName;
}

function buildFolderDescription(path: string): string {
  const normalized = path.replace(/\\/g, "/").replace(/\/+$/, "");
  const parts = normalized.split("/").filter(Boolean);
  const meaningful = parts.filter((part) => !/^[a-zA-Z]:$/.test(part));
  const breadcrumb = meaningful.join(" › ");
  return `${breadcrumb}\n${path}`;
}

function toManagedCategory(category: WorkerCategory, defaultFolder: string): ManagedCategory {
  const folderPath = category.folder_path?.trim() || category.destination_path?.trim() || joinFolderPath(defaultFolder, category.name);
  const color = (category.color?.trim() || "#6366f1").toLowerCase();
  const enabled = typeof category.enabled === "boolean"
    ? category.enabled
    : typeof category.is_active === "boolean"
      ? category.is_active
      : true;
  const aiLearned = typeof category.learning === "boolean"
    ? category.learning
    : typeof category.learning === "number"
      ? category.learning > 0
      : false;

  return {
    id: category.id,
    name: category.name,
    description: category.description,
    color,
    folderPath,
    enabled,
    aiLearned,
    isAutoDescription: category.is_auto_description ?? false,
  };
}

async function fetchFromCandidates<T>(
  candidates: string[],
  request: (baseUrl: string) => Promise<T>,
): Promise<T> {
  let lastError: unknown = null;

  for (const baseUrl of candidates) {
    try {
      return await request(baseUrl);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError ?? new Error("Worker API unavailable");
}

async function getDefaultBasePathFromWorker(fallback: string): Promise<string> {
  return withLlama(['embed'], () => fetchFromCandidates(SETTINGS_API_URL_CANDIDATES, async (baseUrl) => {
    const response = ensureSuccess(
      await fetch(`${baseUrl}/default-base-path`),
      "Failed to load default base path",
    );
    const payload = (await response.json()) as WorkerDefaultBasePathResponse;
    return (payload.default_base_path?.trim() || fallback.trim()).trim();
  }));
}

async function upsertDefaultBasePath(basePath: string, label: string): Promise<string> {
  return withLlama(['embed'], () => fetchFromCandidates(SETTINGS_API_URL_CANDIDATES, async (baseUrl) => {
    const response = ensureSuccess(
      await fetch(`${baseUrl}/default-base-path`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ default_base_path: basePath }),
      }),
      label,
    );
    const payload = (await response.json()) as WorkerDefaultBasePathResponse;
    return (payload.default_base_path?.trim() || basePath.trim()).trim();
  }));
}

export class CategoryManagementService {
  constructor(private repository: CategoryManagementRepository) {}

  async initializeFromWorker(): Promise<void> {
    const fallbackBasePath = await tauriClient.getDownloadsFolder().catch(() => "");

    const defaultFolder = await getDefaultBasePathFromWorker(fallbackBasePath);
    const effectiveDefault = await upsertDefaultBasePath(
      defaultFolder,
      "Failed to initialize base path",
    );

    await this.refreshCategoriesFromWorker(effectiveDefault);
    this.syncToAutomationStores();
  }

  async saveDefaultFolder(path: string): Promise<void> {
    const normalized = path.trim();
    if (!normalized) {
      return;
    }

    const effectiveDefault = await upsertDefaultBasePath(
      normalized,
      "Failed to save default base path",
    );

    await this.refreshCategoriesFromWorker(effectiveDefault);
    this.syncToAutomationStores();
  }

  async addCategoryToWorker(category: Omit<ManagedCategory, "id">): Promise<void> {
    const normalizedName = category.name.trim();
    const normalizedDescription = category.description.trim();
    if (!normalizedName || !normalizedDescription) {
      return;
    }

    const fallbackPath = this.repository.getDefaultFolder();
    const normalizedFolderPath = category.folderPath.trim();
    const inferredFolderPath = normalizedFolderPath || joinFolderPath(fallbackPath, normalizedName);

    await withLlama(['embed'], () => fetchFromCandidates(CATEGORIES_API_URL_CANDIDATES, async (baseUrl) => {
      const response = await fetch(baseUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: normalizedName,
          description: normalizedDescription,
          enabled: category.enabled,
          folder_path: inferredFolderPath,
          color: category.color,
        }),
      });

      ensureSuccess(response, "Failed to create category");
      return true;
    }));

    await this.refreshCategoriesFromWorker();
    this.syncToAutomationStores();
  }

  async updateCategoryInWorker(id: string, updates: Partial<ManagedCategory>): Promise<void> {
    const payload: Record<string, unknown> = {};
    const normalizedUpdates: Partial<ManagedCategory> = {};
    if (typeof updates.name === "string") {
      const value = updates.name.trim();
      payload.name = value;
      normalizedUpdates.name = value;
    }
    if (typeof updates.description === "string") {
      const value = updates.description.trim();
      payload.description = value;
      normalizedUpdates.description = value;
    }
    if (typeof updates.folderPath === "string") {
      const value = updates.folderPath.trim();
      payload.folder_path = value;
      normalizedUpdates.folderPath = value;
    }
    if (typeof updates.enabled === "boolean") {
      payload.enabled = updates.enabled;
      normalizedUpdates.enabled = updates.enabled;
    }
    if (typeof updates.color === "string") {
      const value = updates.color.trim().toLowerCase();
      payload.color = value;
      normalizedUpdates.color = value;
    }

    if (Object.keys(payload).length === 0) {
      return;
    }

    await withLlama(['embed'], () => fetchFromCandidates(CATEGORIES_API_URL_CANDIDATES, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      ensureSuccess(response, "Failed to update category");
      return true;
    }));

    const currentCategories = this.repository.listCategories();
    const nextCategories = currentCategories.map((category) =>
      category.id === id ? { ...category, ...normalizedUpdates } : category,
    );
    this.repository.setManagementState(this.repository.getDefaultFolder(), nextCategories);
    this.syncToAutomationStores();

    await this.refreshCategoriesFromWorker().catch(() => undefined);
  }

  async deleteCategoryInWorker(id: string): Promise<void> {
    await fetchFromCandidates(CATEGORIES_API_URL_CANDIDATES, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/${id}`, {
        method: "DELETE",
      });

      ensureSuccess(response, "Failed to delete category");
      return true;
    });

    await this.refreshCategoriesFromWorker();
    this.syncToAutomationStores();
  }

  async batchCreateFromFolders(items: Array<{ name: string; path: string }>): Promise<void> {
    if (!items.length) return;

    const categories = items.map((item) => ({
      name: item.name,
      description: buildFolderDescription(item.path),
      enabled: true,
      folder_path: item.path,
      color: null,
      is_auto_description: true,
    }));

    await withLlama(['embed'], () => fetchFromCandidates(CATEGORIES_API_URL_CANDIDATES, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/batch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categories }),
      });
      ensureSuccess(response, "Failed to batch create categories");
      return true;
    }));

    await this.refreshCategoriesFromWorker();
    this.syncToAutomationStores();
  }

  async refreshCategoriesFromWorker(defaultFolderOverride?: string): Promise<void> {
    const fallbackDefaultFolder = defaultFolderOverride ?? this.repository.getDefaultFolder();
    const defaultFolderFromWorker = await getDefaultBasePathFromWorker(fallbackDefaultFolder);
    const state = await fetchFromCandidates(
      CATEGORIES_API_URL_CANDIDATES,
      async (baseUrl): Promise<{ defaultFolder: string; categories: ManagedCategory[] }> => {
        const response = ensureSuccess(
          await fetch(`${baseUrl}?active_only=false`),
          "Failed to load categories",
        );
        const payload = (await response.json()) as WorkerCategory[];
        const defaultFolder = defaultFolderFromWorker.trim();

        return {
          defaultFolder,
          categories: payload.map((category) => toManagedCategory(category, defaultFolder)),
        };
      },
    );

    this.repository.setManagementState(state.defaultFolder, state.categories);
  }

  syncToAutomationStores() {
    const managedCategories = this.repository.listCategories();
    const activeCategoryNames = new Set(managedCategories.map((category) => category.name));

    useCategoryStore.getState().setCategories(
      managedCategories.map((category) => ({
        id: category.id,
        name: category.name,
        systemGenerated: category.aiLearned,
        active: category.enabled,
      })),
    );

    managedCategories.forEach((category) => {
      useRuleStore
        .getState()
        .setMapping(category.name, category.folderPath, category.enabled);
    });

    const ruleStore = useRuleStore.getState();
    ruleStore.categoryToFolderMap
      .filter((mapping) => !activeCategoryNames.has(mapping.categoryName))
      .forEach((mapping) => {
        useRuleStore.getState().removeMapping(mapping.categoryName);
      });
  }
}

const repository = new ZustandCategoryManagementRepository();
export const categoryManagementService = new CategoryManagementService(repository);
