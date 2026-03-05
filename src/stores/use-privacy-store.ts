import { create } from "zustand";
import { persist } from "zustand/middleware";

interface PrivacyStoreState {
  lockedPaths: string[];
  lockPath: (path: string) => void;
  unlockPath: (path: string) => void;
  isLocked: (path: string) => boolean;
}

export const usePrivacyStore = create<PrivacyStoreState>()(
  persist(
    (set, get) => ({
      lockedPaths: [],
      lockPath: (path) =>
        set((state) => ({
          lockedPaths: state.lockedPaths.includes(path)
            ? state.lockedPaths
            : [...state.lockedPaths, path],
        })),
      unlockPath: (path) =>
        set((state) => ({
          lockedPaths: state.lockedPaths.filter((item) => item !== path),
        })),
      isLocked: (path) =>
        get().lockedPaths.some((locked) => path === locked || path.startsWith(locked + "/") || path.startsWith(locked + "\\\\") ),
    }),
    {
      name: "klin-privacy-store",
    },
  ),
);
