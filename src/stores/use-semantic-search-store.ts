import { create } from "zustand";
import { fileSearchApiService } from "@/services/file-search-api-service";
import type { FileSearchResultItem, SemanticStatus } from "@/types/domain";
import { logger } from "@/lib/logger";

interface SemanticSearchState {
  // Input + UI
  query: string;
  isDropdownOpen: boolean;

  // Request lifecycle
  loading: boolean;
  startedAt: number | null;
  submitted: boolean;
  acknowledged: boolean; // user has seen the latest result

  // Result
  results: FileSearchResultItem[];
  semanticStatus: SemanticStatus;
  semanticError: string | null;
  indexingPendingCount: number;
  error: string | null;

  // In-flight controller (not React state — stored on the store object)
  _controller: AbortController | null;
  _requestId: number;

  // Actions
  setQuery: (q: string) => void;
  openDropdown: () => void;
  closeDropdown: () => void;
  submit: (q?: string) => Promise<void>;
  cancel: () => void;
  reset: () => void;
  acknowledge: () => void;
}

export const useSemanticSearchStore = create<SemanticSearchState>((set, get) => ({
  query: "",
  isDropdownOpen: false,

  loading: false,
  startedAt: null,
  submitted: false,
  acknowledged: true,

  results: [],
  semanticStatus: "ready",
  semanticError: null,
  indexingPendingCount: 0,
  error: null,

  _controller: null,
  _requestId: 0,

  setQuery: (q) => set({ query: q }),

  openDropdown: () => set({ isDropdownOpen: true, acknowledged: true }),

  closeDropdown: () => set({ isDropdownOpen: false }),

  submit: async (q) => {
    const text = (q ?? get().query).trim();
    if (!text) {
      set({ results: [], error: null, submitted: false });
      return;
    }

    // Cancel any prior in-flight request
    get()._controller?.abort();

    const controller = new AbortController();
    const requestId = get()._requestId + 1;

    set({
      _controller: controller,
      _requestId: requestId,
      loading: true,
      startedAt: Date.now(),
      error: null,
      submitted: true,
      acknowledged: true,
      isDropdownOpen: true,
    });

    try {
      const response = await fileSearchApiService.search(text, controller.signal);

      // Stale guard — only commit if this is still the latest request
      if (get()._requestId !== requestId) return;

      set({
        results: response.results,
        semanticStatus: response.semanticStatus,
        semanticError: response.semanticError,
        indexingPendingCount: response.indexingPendingCount,
        loading: false,
        startedAt: null,
        _controller: null,
        // If the dropdown is closed, mark as unacknowledged so the bubble
        // pulses to draw the user's attention back.
        acknowledged: get().isDropdownOpen,
      });
    } catch (error) {
      if ((error as { name?: string })?.name === "AbortError") return;
      if (get()._requestId !== requestId) return;

      logger.warn("[semantic-search] request failed", error);
      set({
        results: [],
        loading: false,
        startedAt: null,
        _controller: null,
        error: error instanceof Error ? error.message : "Search failed",
        acknowledged: get().isDropdownOpen,
      });
    }
  },

  cancel: () => {
    get()._controller?.abort();
    set({
      _controller: null,
      loading: false,
      startedAt: null,
    });
  },

  reset: () => {
    get()._controller?.abort();
    set({
      query: "",
      isDropdownOpen: false,
      loading: false,
      startedAt: null,
      submitted: false,
      acknowledged: true,
      results: [],
      semanticStatus: "ready",
      semanticError: null,
      indexingPendingCount: 0,
      error: null,
      _controller: null,
    });
  },

  acknowledge: () => set({ acknowledged: true }),
}));

export function selectHasPendingActivity(state: SemanticSearchState): boolean {
  return state.loading || (!state.acknowledged && (state.results.length > 0 || state.error !== null));
}
