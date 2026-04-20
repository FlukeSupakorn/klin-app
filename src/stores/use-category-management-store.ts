import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ManagedCategory } from "@/types/domain";

interface CategoryManagementState {
  defaultFolder: string;
  categories: ManagedCategory[];
  setManagementState: (defaultFolder: string, categories: ManagedCategory[]) => void;
  setDefaultFolder: (path: string) => void;
  addCategory: (category: Omit<ManagedCategory, "id">) => void;
  updateCategory: (id: string, updates: Partial<ManagedCategory>) => void;
  deleteCategory: (id: string) => void;
}

const defaultFolder = "";

const initialCategories: ManagedCategory[] = [];

export const useCategoryManagementStore = create<CategoryManagementState>()(
  persist(
    (set) => ({
      defaultFolder,
      categories: initialCategories,
      setManagementState: (nextDefaultFolder, nextCategories) =>
        set({
          defaultFolder: nextDefaultFolder.trim(),
          categories: nextCategories,
        }),
      setDefaultFolder: (path) => {
        set((state) => {
          const normalized = path.trim();
          if (!normalized) {
            return state;
          }

          const nextCategories = state.categories.map((category) => {
            const tail = category.folderPath.split("/").pop() ?? category.name;
            return {
              ...category,
              folderPath: `${normalized}/${tail}`,
            };
          });

          return {
            defaultFolder: normalized,
            categories: nextCategories,
          };
        });
      },
      addCategory: (category) =>
        set((state) => ({
          categories: [
            ...state.categories,
            {
              ...category,
              id: crypto.randomUUID(),
            },
          ],
        })),
      updateCategory: (id, updates) =>
        set((state) => ({
          categories: state.categories.map((category) =>
            category.id === id ? { ...category, ...updates } : category,
          ),
        })),
      deleteCategory: (id) =>
        set((state) => ({
          categories: state.categories.filter((category) => category.id !== id),
        })),
    }),
    {
      name: "klin-category-management-store",
    },
  ),
);
