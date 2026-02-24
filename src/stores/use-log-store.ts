import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AutomationLog, LogFilter, PaginationState } from "@/types/domain";

interface LogStoreState {
  logs: AutomationLog[];
  filters: LogFilter;
  pagination: PaginationState;
  setLogs: (logs: AutomationLog[]) => void;
  appendLog: (log: AutomationLog) => void;
  setFilters: (filters: Partial<LogFilter>) => void;
  setPage: (page: number) => void;
  setPageSize: (pageSize: number) => void;
  filteredLogs: () => AutomationLog[];
  pagedLogs: () => AutomationLog[];
}

export const useLogStore = create<LogStoreState>()(
  persist(
    (set, get) => ({
      logs: [],
      filters: {
        search: "",
        status: "all",
        category: "",
      },
      pagination: {
        page: 1,
        pageSize: 10,
      },
      setLogs: (logs) => set({ logs }),
      appendLog: (log) => set((state) => ({ logs: [log, ...state.logs] })),
      setFilters: (filters) => set((state) => ({ filters: { ...state.filters, ...filters } })),
      setPage: (page) => set((state) => ({ pagination: { ...state.pagination, page } })),
      setPageSize: (pageSize) =>
        set((state) => ({ pagination: { ...state.pagination, pageSize, page: 1 } })),
      filteredLogs: () => {
        const state = get();
        return state.logs.filter((log) => {
          const bySearch =
            state.filters.search.length === 0 ||
            log.fileName.toLowerCase().includes(state.filters.search.toLowerCase()) ||
            log.originalPath.toLowerCase().includes(state.filters.search.toLowerCase());
          const byStatus = state.filters.status === "all" || log.status === state.filters.status;
          const byCategory = state.filters.category.length === 0 || log.chosenCategory === state.filters.category;
          return bySearch && byStatus && byCategory;
        });
      },
      pagedLogs: () => {
        const state = get();
        const filtered = state.filteredLogs();
        const start = (state.pagination.page - 1) * state.pagination.pageSize;
        return filtered.slice(start, start + state.pagination.pageSize);
      },
    }),
    {
      name: "klin-log-store",
    },
  ),
);
