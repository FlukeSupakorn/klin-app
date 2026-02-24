import { create } from "zustand";
import { persist } from "zustand/middleware";

interface PrivacyStoreState {
  exclusionPatterns: string[];
  addPattern: (pattern: string) => void;
  removePattern: (pattern: string) => void;
  isExcluded: (path: string) => boolean;
}

export const usePrivacyStore = create<PrivacyStoreState>()(
  persist(
    (set, get) => ({
      exclusionPatterns: ["password", ".key", "secret"],
      addPattern: (pattern) =>
        set((state) => ({
          exclusionPatterns: state.exclusionPatterns.includes(pattern)
            ? state.exclusionPatterns
            : [...state.exclusionPatterns, pattern],
        })),
      removePattern: (pattern) =>
        set((state) => ({
          exclusionPatterns: state.exclusionPatterns.filter((item) => item !== pattern),
        })),
      isExcluded: (path) =>
        get().exclusionPatterns.some((pattern) => path.toLowerCase().includes(pattern.toLowerCase())),
    }),
    {
      name: "klin-privacy-store",
    },
  ),
);
