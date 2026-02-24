import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Category } from "@/types/domain";

interface CategoryStoreState {
  categories: Category[];
  setCategories: (categories: Category[]) => void;
  createCategory: (name: string, systemGenerated?: boolean) => void;
  updateCategory: (id: string, updates: Partial<Category>) => void;
  deleteCategory: (id: string) => void;
}

export const useCategoryStore = create<CategoryStoreState>()(
  persist(
    (set) => ({
      categories: [
        { id: "finance", name: "Finance", systemGenerated: true, active: true },
        { id: "work", name: "Work", systemGenerated: true, active: true },
        { id: "personal", name: "Personal", systemGenerated: true, active: true },
      ],
      setCategories: (categories) => set({ categories }),
      createCategory: (name, systemGenerated = false) =>
        set((state) => ({
          categories: [
            ...state.categories,
            {
              id: crypto.randomUUID(),
              name,
              systemGenerated,
              active: true,
            },
          ],
        })),
      updateCategory: (id, updates) =>
        set((state) => ({
          categories: state.categories.map((item) =>
            item.id === id ? { ...item, ...updates } : item,
          ),
        })),
      deleteCategory: (id) =>
        set((state) => ({
          categories: state.categories.filter((item) => item.id !== id),
        })),
    }),
    {
      name: "klin-category-store",
    },
  ),
);
