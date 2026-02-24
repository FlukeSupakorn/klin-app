import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { RuleMapping } from "@/types/domain";

interface RuleStoreState {
  categoryToFolderMap: RuleMapping[];
  setMapping: (categoryName: string, folderPath: string, isActive?: boolean) => void;
  removeMapping: (categoryName: string) => void;
  validateMapping: (mapping: RuleMapping) => boolean;
}

export const useRuleStore = create<RuleStoreState>()(
  persist(
    (set, get) => ({
      categoryToFolderMap: [],
      setMapping: (categoryName, folderPath, isActive = true) => {
        const next: RuleMapping = { categoryName, folderPath, isActive };
        if (!get().validateMapping(next)) {
          return;
        }

        set((state) => {
          const exists = state.categoryToFolderMap.some((item) => item.categoryName === categoryName);
          if (exists) {
            return {
              categoryToFolderMap: state.categoryToFolderMap.map((item) =>
                item.categoryName === categoryName ? next : item,
              ),
            };
          }
          return { categoryToFolderMap: [...state.categoryToFolderMap, next] };
        });
      },
      removeMapping: (categoryName) =>
        set((state) => ({
          categoryToFolderMap: state.categoryToFolderMap.filter(
            (item) => item.categoryName !== categoryName,
          ),
        })),
      validateMapping: (mapping) => Boolean(mapping.categoryName.trim() && mapping.folderPath.trim()),
    }),
    {
      name: "klin-rule-store",
    },
  ),
);
