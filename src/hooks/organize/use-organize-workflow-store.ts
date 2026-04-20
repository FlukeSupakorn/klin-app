import { create } from "zustand";
import type { OrganizePreviewItem } from "@/types/domain";

interface OrganizeWorkflowStoreState {
  items: OrganizePreviewItem[];
  modalOpen: boolean;
  isAnalyzing: boolean;
  errorMessage: string | null;
  openSuggestionFor: string | null;
  openSettingsWindow: boolean;
  isDraggingOver: boolean;
  lastNativeDropAt: number;
  resumeDismissed: boolean;
  setItems: (updater: OrganizePreviewItem[] | ((prev: OrganizePreviewItem[]) => OrganizePreviewItem[])) => void;
  setModalOpen: (open: boolean) => void;
  setIsAnalyzing: (value: boolean) => void;
  setErrorMessage: (value: string | null) => void;
  setOpenSuggestionFor: (value: string | null | ((prev: string | null) => string | null)) => void;
  setOpenSettingsWindow: (open: boolean) => void;
  setIsDraggingOver: (value: boolean) => void;
  setLastNativeDropAt: (value: number) => void;
  dismissResumeBubble: () => void;
  resetResumeDismissed: () => void;
  cancelPendingItems: () => void;
  clearCompletedItems: () => void;
  cancelItemById: (itemId: string) => void;
  clearAll: () => void;
}

export const useOrganizeWorkflowStore = create<OrganizeWorkflowStoreState>((set) => ({
  items: [],
  modalOpen: false,
  isAnalyzing: false,
  errorMessage: null,
  openSuggestionFor: null,
  openSettingsWindow: false,
  isDraggingOver: false,
  lastNativeDropAt: 0,
  resumeDismissed: false,
  setItems: (updater) =>
    set((state) => ({
      items: typeof updater === "function" ? updater(state.items) : updater,
    })),
  setModalOpen: (open) => set({ modalOpen: open }),
  setIsAnalyzing: (value) => set({ isAnalyzing: value }),
  setErrorMessage: (value) => set({ errorMessage: value }),
  setOpenSuggestionFor: (value) =>
    set((state) => ({
      openSuggestionFor: typeof value === "function" ? value(state.openSuggestionFor) : value,
    })),
  setOpenSettingsWindow: (open) => set({ openSettingsWindow: open }),
  setIsDraggingOver: (value) => set({ isDraggingOver: value }),
  setLastNativeDropAt: (value) => set({ lastNativeDropAt: value }),
  dismissResumeBubble: () => set({ resumeDismissed: true }),
  resetResumeDismissed: () => set({ resumeDismissed: false }),
  cancelPendingItems: () =>
    set((state) => ({
      items: state.items.filter((item) => item.analysisStatus !== "queued" && item.analysisStatus !== "processing"),
      isAnalyzing: false,
    })),
  clearCompletedItems: () =>
    set((state) => ({
      items: state.items.filter((item) => item.analysisStatus === "queued" || item.analysisStatus === "processing"),
    })),
  cancelItemById: (itemId) =>
    set((state) => ({
      items: state.items.filter((item) => item.id !== itemId),
    })),
  clearAll: () =>
    set({
      items: [],
      errorMessage: null,
      openSuggestionFor: null,
      modalOpen: false,
      isAnalyzing: false,
      resumeDismissed: true,
    }),
}));
