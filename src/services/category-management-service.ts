import { useCategoryManagementStore } from "@/stores/use-category-management-store";
import { useCategoryStore } from "@/stores/use-category-store";
import { useRuleStore } from "@/stores/use-rule-store";
import type { ManagedCategory } from "@/types/domain";

export interface CategoryManagementRepository {
  getDefaultFolder(): string;
  setDefaultFolder(path: string): void;
  listCategories(): ManagedCategory[];
  addCategory(category: Omit<ManagedCategory, "id">): void;
  updateCategory(id: string, updates: Partial<ManagedCategory>): void;
}

class ZustandCategoryManagementRepository implements CategoryManagementRepository {
  getDefaultFolder() {
    return useCategoryManagementStore.getState().defaultFolder;
  }

  setDefaultFolder(path: string) {
    useCategoryManagementStore.getState().setDefaultFolder(path);
  }

  listCategories() {
    return useCategoryManagementStore.getState().categories;
  }

  addCategory(category: Omit<ManagedCategory, "id">) {
    useCategoryManagementStore.getState().addCategory(category);
  }

  updateCategory(id: string, updates: Partial<ManagedCategory>) {
    useCategoryManagementStore.getState().updateCategory(id, updates);
  }
}

export class CategoryManagementService {
  constructor(private repository: CategoryManagementRepository) {}

  syncToAutomationStores() {
    const managedCategories = this.repository.listCategories();

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
  }
}

const repository = new ZustandCategoryManagementRepository();
export const categoryManagementService = new CategoryManagementService(repository);
