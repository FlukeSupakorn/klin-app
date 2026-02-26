import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ManagedCategory } from "@/types/domain";

interface CategoryManagementState {
  defaultFolder: string;
  categories: ManagedCategory[];
  setDefaultFolder: (path: string) => void;
  addCategory: (category: Omit<ManagedCategory, "id">) => void;
  updateCategory: (id: string, updates: Partial<ManagedCategory>) => void;
  deleteCategory: (id: string) => void;
}

const defaultFolder = "/Users/sarun/Pictures";

const initialCategories: ManagedCategory[] = [
  {
    id: "documents",
    name: "Documents",
    description: "general documents, miscellaneous files, unclassified content, various documents",
    folderPath: `${defaultFolder}/Documents`,
    enabled: true,
    aiLearned: true,
  },
  {
    id: "education",
    name: "Education & Learning",
    description: "course materials, study notes, educational resources, learning materials, textbooks",
    folderPath: `${defaultFolder}/Education & Learning`,
    enabled: true,
    aiLearned: true,
  },
  {
    id: "finance",
    name: "Finance & Invoices",
    description: "invoices, receipts, payment records, billing statements, financial transactions",
    folderPath: `${defaultFolder}/Finance & Invoices`,
    enabled: true,
    aiLearned: true,
  },
  {
    id: "travel",
    name: "Travel & Vacation",
    description: "flight tickets, hotel reservations, travel itineraries, trip planning",
    folderPath: `${defaultFolder}/Travel & Vacation`,
    enabled: true,
    aiLearned: true,
  },
  {
    id: "work",
    name: "Work & Projects",
    description: "business documents, project plans, meeting notes, proposals",
    folderPath: `${defaultFolder}/Work & Projects`,
    enabled: true,
    aiLearned: true,
  },
  {
    id: "tech",
    name: "Technology & Manuals",
    description: "technical documentation, user manuals, AI guides, system specifications",
    folderPath: `${defaultFolder}/Technology & Manuals`,
    enabled: true,
    aiLearned: true,
  },
  {
    id: "legal",
    name: "Legal & Contracts",
    description: "contracts, legal agreements, terms and conditions, legal notices",
    folderPath: `${defaultFolder}/Legal & Contracts`,
    enabled: false,
    aiLearned: false,
  },
];

export const useCategoryManagementStore = create<CategoryManagementState>()(
  persist(
    (set) => ({
      defaultFolder,
      categories: initialCategories,
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
