import { useCategoryManagementStore } from "@/stores/use-category-management-store";
import { useCategoryStore } from "@/stores/use-category-store";
import { useRuleStore } from "@/stores/use-rule-store";
import { tauriClient } from "@/services/tauri-client";
import type { ManagedCategory } from "@/types/domain";

const SETTINGS_API_URL_CANDIDATES = [
  "http://127.0.0.1:8000/api/settings",
  "http://localhost:8000/api/settings",
];

const CATEGORIES_API_URL_CANDIDATES = [
  "http://127.0.0.1:8000/api/settings/categories",
  "http://localhost:8000/api/settings/categories",
  // Backward-compatible fallback for older worker builds.
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
}

interface WorkerDefaultBasePathResponse {
  default_base_path: string | null;
}

interface WorkerInitialBasePathResponse {
  default_base_path: string;
  categories: WorkerCategory[];
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
  return fetchFromCandidates(SETTINGS_API_URL_CANDIDATES, async (baseUrl) => {
    const response = ensureSuccess(
      await fetch(`${baseUrl}/default-base-path`),
      "Failed to load default base path",
    );
    const payload = (await response.json()) as WorkerDefaultBasePathResponse;
    return (payload.default_base_path?.trim() || fallback.trim()).trim();
  });
}

export class CategoryManagementService {
  constructor(private repository: CategoryManagementRepository) {}

  async initializeFromWorker(): Promise<void> {
    const fallbackBasePath = await tauriClient.getDownloadsFolder().catch(() => "");

    const state = await fetchFromCandidates(
      SETTINGS_API_URL_CANDIDATES,
      async (baseUrl): Promise<{ defaultFolder: string; categories: ManagedCategory[] }> => {
        const defaultFolder = await getDefaultBasePathFromWorker(fallbackBasePath);

        const initialResponse = ensureSuccess(
          await fetch(`${baseUrl}/initial-base-path`, {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ default_base_path: defaultFolder }),
          }),
          "Failed to initialize base path",
        );

        const initialPayload = (await initialResponse.json()) as WorkerInitialBasePathResponse;
        const effectiveDefault = initialPayload.default_base_path?.trim() || defaultFolder;

        return {
          defaultFolder: effectiveDefault,
          categories: initialPayload.categories.map((category) => toManagedCategory(category, effectiveDefault)),
        };
      },
    );

    this.repository.setManagementState(state.defaultFolder, state.categories);
    this.syncToAutomationStores();
  }

  async saveDefaultFolder(path: string): Promise<void> {
    const normalized = path.trim();
    if (!normalized) {
      return;
    }

    await fetchFromCandidates(SETTINGS_API_URL_CANDIDATES, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/default-base-path`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ default_base_path: normalized }),
      });

      ensureSuccess(response, "Failed to save default base path");
      return true;
    });

    await this.refreshCategoriesFromWorker(normalized);
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

    await fetchFromCandidates(CATEGORIES_API_URL_CANDIDATES, async (baseUrl) => {
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
    });

    await this.refreshCategoriesFromWorker();
    this.syncToAutomationStores();
  }

  async updateCategoryInWorker(id: string, updates: Partial<ManagedCategory>): Promise<void> {
    const payload: Record<string, unknown> = {};
    if (typeof updates.name === "string") {
      payload.name = updates.name.trim();
    }
    if (typeof updates.description === "string") {
      payload.description = updates.description.trim();
    }
    if (typeof updates.folderPath === "string") {
      payload.folder_path = updates.folderPath.trim();
    }
    if (typeof updates.enabled === "boolean") {
      payload.enabled = updates.enabled;
    }
    if (typeof updates.color === "string") {
      payload.color = updates.color.trim();
    }

    if (Object.keys(payload).length === 0) {
      return;
    }

    await fetchFromCandidates(CATEGORIES_API_URL_CANDIDATES, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      ensureSuccess(response, "Failed to update category");
      return true;
    });

    await this.refreshCategoriesFromWorker();
    this.syncToAutomationStores();
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
