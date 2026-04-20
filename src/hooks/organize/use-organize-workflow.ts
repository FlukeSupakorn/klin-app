import { useMemo } from "react";
import type { DragEvent } from "react";
import { useCategoryManagementStore } from "@/stores/use-category-management-store";
import { splitDestinationPath } from "@/lib/path-utils";
import type { OrganizePreviewItem } from "@/types/domain";
import {
  applyCategoryToItem,
  applySuggestedNameToItem,
  computeOrganizeWorkflowMetrics,
} from "@/features/dashboard/organize-files-panel/organize-workflow-utils";
import { useOrganizeWorkflowStore } from "./use-organize-workflow-store";
import { useOrganizeQueue } from "./use-organize-queue";
import { useOrganizeFileOps } from "./use-organize-file-ops";
import { useOrganizeDragDrop } from "./use-organize-drag-drop";

export interface OrganizeWorkflow {
  items: OrganizePreviewItem[];
  modalOpen: boolean;
  isAnalyzing: boolean;
  errorMessage: string | null;
  openSuggestionFor: string | null;
  openSettingsWindow: boolean;
  isDraggingOver: boolean;
  readyCount: number;
  processingCount: number;
  queuedCount: number;
  failedCount: number;
  movedCount: number;
  readyToMoveCount: number;
  allReadyMoved: boolean;
  canUndoAll: boolean;
  unresolvedCount: number;
  showResumeOrganizeBubble: boolean;
  handleAddFiles: () => Promise<void>;
  handleDrop: (event: DragEvent<HTMLDivElement>) => void;
  closeModal: () => void;
  openModal: () => void;
  setOpenSettingsWindow: (open: boolean) => void;
  toggleSuggestionFor: (itemId: string) => void;
  updateFileName: (itemId: string, fileName: string) => void;
  setNoMoveCategory: (itemId: string) => void;
  applyCategory: (itemId: string, categoryName: string) => void;
  applySuggestedName: (itemId: string, selectedName: string | null) => void;
  cancelItem: (itemId: string) => void;
  cancelOrganize: () => void;
  clearCompleted: () => void;
  retryAnalyzeItem: (itemId: string) => void;
  moveSingleItem: (item: OrganizePreviewItem) => Promise<void>;
  undoSingleItem: (item: OrganizePreviewItem) => Promise<void>;
  moveAllPending: () => Promise<void>;
  undoAllMoved: () => Promise<void>;
}

export function useOrganizeWorkflow(): OrganizeWorkflow {
  const categories = useCategoryManagementStore((state) => state.categories);
  const defaultFolder = useCategoryManagementStore((state) => state.defaultFolder);

  const {
    items,
    modalOpen,
    isAnalyzing,
    errorMessage,
    openSuggestionFor,
    openSettingsWindow,
    isDraggingOver,
    resumeDismissed,
    setItems,
    setModalOpen,
    setIsAnalyzing,
    setErrorMessage,
    setOpenSuggestionFor,
    setOpenSettingsWindow,
    setIsDraggingOver,
    setLastNativeDropAt,
    resetResumeDismissed,
    cancelPendingItems,
    clearCompletedItems,
    cancelItemById,
    clearAll,
  } = useOrganizeWorkflowStore((state) => state);

  const buildDestinationPath = (folderPath: string, fileName: string) => {
    const trimmedFolder = folderPath.trim();
    const trimmedFileName = fileName.trim();
    if (!trimmedFolder) {
      return trimmedFileName;
    }

    const separator = trimmedFolder.includes("\\") ? "\\" : "/";
    return `${trimmedFolder}${separator}${trimmedFileName}`;
  };

  // Queue management hook (handles analysis queue, file picking, retry logic)
  const queueOps = useOrganizeQueue({
    items,
    isAnalyzing,
    categories,
    defaultFolder,
    setItems,
    setModalOpen,
    setIsAnalyzing,
    setErrorMessage,
    resetResumeDismissed,
    cancelItemById,
    cancelPendingItems,
  });

  // File operations hook (handles move, undo, bulk operations)
  const fileOps = useOrganizeFileOps({
    items,
    categories,
    setItems,
    setErrorMessage,
  });

  // Drag-drop hook
  const dragDropOps = useOrganizeDragDrop({
    openWithPaths: queueOps.openWithPaths,
    setIsDraggingOver,
    setLastNativeDropAt,
  });

  // State update helpers
  const applyCategory = (itemId: string, categoryName: string) => {
    setItems((state) => state.map((item) => (
      item.id === itemId ? applyCategoryToItem(item, categoryName, categories, defaultFolder) : item
    )));
  };

  const setNoMoveCategory = (itemId: string) => {
    setItems((state) => state.map((item) => {
      if (item.id !== itemId) {
        return item;
      }

      const { fileName } = splitDestinationPath(item.destinationPath);
      const { folderPath } = splitDestinationPath(item.currentPath);
      const nextDestinationPath = buildDestinationPath(folderPath, fileName);

      return {
        ...item,
        selectedCategory: "No category",
        destinationPath: nextDestinationPath,
      };
    }));
  };

  const updateFileName = (itemId: string, fileName: string) => {
    const nextFileName = fileName.trim();
    if (!nextFileName) {
      return;
    }

    setItems((state) => state.map((item) => {
      if (item.id !== itemId) {
        return item;
      }

      const { folderPath } = splitDestinationPath(item.destinationPath);
      const nextDestinationPath = buildDestinationPath(folderPath, nextFileName);
      return {
        ...item,
        destinationPath: nextDestinationPath,
        selectedCategory: item.selectedCategory,
      };
    }));
  };

  const applySuggestedName = (itemId: string, selectedName: string | null) => {
    setItems((state) => state.map((item) => (
      item.id === itemId ? applySuggestedNameToItem(item, selectedName) : item
    )));
    setOpenSuggestionFor(null);
  };

  const closeModal = () => {
    const hasActiveQueue = items.some(
      (item) => item.analysisStatus === "queued" || item.analysisStatus === "processing",
    );

    setModalOpen(false);

    // If all work is settled, close acts like session cleanup.
    if (!hasActiveQueue) {
      clearAll();
    }
  };

  const metrics = useMemo(
    () => computeOrganizeWorkflowMetrics(items, modalOpen, isAnalyzing, resumeDismissed),
    [items, modalOpen, isAnalyzing, resumeDismissed],
  );

  return {
    items,
    modalOpen,
    isAnalyzing,
    errorMessage,
    openSuggestionFor,
    openSettingsWindow,
    isDraggingOver,
    ...metrics,
    // Queue operations
    handleAddFiles: queueOps.handleAddFiles,
    retryAnalyzeItem: queueOps.retryAnalyzeItem,
    cancelItem: queueOps.cancelItem,
    cancelOrganize: queueOps.cancelOrganize,
    // File operations
    handleDrop: dragDropOps.handleDrop,
    moveSingleItem: fileOps.moveSingleItem,
    undoSingleItem: fileOps.undoSingleItem,
    moveAllPending: fileOps.moveAllPending,
    undoAllMoved: fileOps.undoAllMoved,
    // State management
    closeModal,
    openModal: () => setModalOpen(true),
    setOpenSettingsWindow,
    toggleSuggestionFor: (itemId: string) => {
      setOpenSuggestionFor((state) => (state === itemId ? null : itemId));
    },
    updateFileName,
    setNoMoveCategory,
    applyCategory,
    applySuggestedName,
    clearCompleted: clearCompletedItems,
  };
}
