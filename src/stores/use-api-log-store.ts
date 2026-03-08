import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface ApiLogEntry {
  id: string;
  timestamp: string;
  method: string;
  url: string;
  status: number;
  latencyMs: number;
  requestBody?: string | null;
  responseBody?: string | null;
  error?: string | null;
}

interface ApiLogStoreState {
  logs: ApiLogEntry[];
  addLog: (log: Omit<ApiLogEntry, "id">) => void;
  clearLogs: () => void;
  cleanupOldLogs: () => void;
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_LOGS = 1000;

export const useApiLogStore = create<ApiLogStoreState>()(
  persist(
    (set) => ({
      logs: [],
      addLog: (log) =>
        set((state) => {
          const newLog = { ...log, id: crypto.randomUUID() };
          const now = Date.now();
          const filteredLogs = state.logs.filter(
            (l) => now - new Date(l.timestamp).getTime() < SEVEN_DAYS_MS
          );
          const newLogs = [newLog, ...filteredLogs].slice(0, MAX_LOGS);
          return { logs: newLogs };
        }),
      clearLogs: () => set({ logs: [] }),
      cleanupOldLogs: () =>
        set((state) => {
          const now = Date.now();
          const filteredLogs = state.logs.filter(
            (l) => now - new Date(l.timestamp).getTime() < SEVEN_DAYS_MS
          );
          return { logs: filteredLogs };
        }),
    }),
    {
      name: "klin-api-log-store",
      onRehydrateStorage: () => (state) => {
        if (state) {
          // Cleanup old logs right after the store is rehydrated from localStorage
          setTimeout(() => state.cleanupOldLogs(), 0);
        }
      },
    }
  )
);
