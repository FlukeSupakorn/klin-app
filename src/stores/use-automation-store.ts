import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AutomationStoreState {
  watchedFolders: string[];
  isRunning: boolean;
  lastScanTime: string | null;
  concurrencyLimit: number;
  addWatchedFolder: (folder: string) => void;
  removeWatchedFolder: (folder: string) => void;
  setRunning: (value: boolean) => void;
  setLastScanTime: (value: string) => void;
  setConcurrencyLimit: (value: number) => void;
}

export const useAutomationStore = create<AutomationStoreState>()(
  persist(
    (set) => ({
      watchedFolders: [],
      isRunning: false,
      lastScanTime: null,
      concurrencyLimit: 3,
      addWatchedFolder: (folder) =>
        set((state) => ({
          watchedFolders: state.watchedFolders.includes(folder)
            ? state.watchedFolders
            : [...state.watchedFolders, folder],
        })),
      removeWatchedFolder: (folder) =>
        set((state) => ({
          watchedFolders: state.watchedFolders.filter((item) => item !== folder),
        })),
      setRunning: (value) => set({ isRunning: value }),
      setLastScanTime: (value) => set({ lastScanTime: value }),
      setConcurrencyLimit: (value) => set({ concurrencyLimit: Math.max(1, value) }),
    }),
    {
      name: "klin-automation-store",
    },
  ),
);
