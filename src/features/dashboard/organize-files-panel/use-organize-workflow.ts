import { useEffect, useMemo, useRef } from "react";
import type { DragEvent } from "react";
import { organizeApiService } from "@/services/organize-api-service";
import { tauriClient } from "@/services/tauri-client";
import { useCategoryManagementStore } from "@/stores/use-category-management-store";
import { useLogStore } from "@/stores/use-log-store";
import type { AutomationLog, OrganizePreviewItem } from "@/types/domain";
import {
  applyCategoryToItem,
  applySuggestedNameToItem,
  buildQueuedItem,
  computeOrganizeWorkflowMetrics,
  normalizeSelectedPaths,
} from "./organize-workflow-utils";
import { useOrganizeDragDrop } from "./use-organize-drag-drop";
import { useOrganizeWorkflowStore } from "./use-organize-workflow-store";

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
    lastNativeDropAt,
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

  const itemsRef = useRef<OrganizePreviewItem[]>(items);
  itemsRef.current = items;
  const isQueueRunningRef = useRef(false);

  const runAnalyzeQueue = async () => {
    if (isQueueRunningRef.current) {
      return;
    }

    isQueueRunningRef.current = true;
    setIsAnalyzing(true);
    let hasFailures = false;

    try {
      while (true) {
        const nextQueuedItem = itemsRef.current.find((item) => item.analysisStatus === "queued");
        if (!nextQueuedItem) {
          break;
        }

        setItems((state) => state.map((item) => (
          item.id === nextQueuedItem.id
            ? { ...item, analysisStatus: "processing", analysisError: null }
            : item
        )));

        try {
          // Keep sequential analysis so queue progress is deterministic in the modal.
          // eslint-disable-next-line no-await-in-loop
          const analyzedItem = await organizeApiService.analyzeOne(nextQueuedItem.currentPath, categories);

          setItems((state) => state.map((item) => (
            item.id === nextQueuedItem.id
              ? {
                ...item,
                ...analyzedItem,
                id: item.id,
                currentPath: item.currentPath,
                fileName: item.fileName,
                analysisStatus: analyzedItem.analysisStatus === "failed" ? "failed" : "completed",
                analysisError: analyzedItem.analysisError,
                moveStatus: item.moveStatus === "completed" ? "completed" : "idle",
              }
              : item
          )));

          if (analyzedItem.analysisStatus === "failed") {
            hasFailures = true;
          }
        } catch (error) {
          hasFailures = true;
          const reason = error instanceof Error ? error.message : "Unknown analysis error";

          setItems((state) => state.map((item) => (
            item.id === nextQueuedItem.id
              ? { ...item, analysisStatus: "failed", analysisError: reason }
              : item
          )));
        }
      }
    } finally {
      isQueueRunningRef.current = false;
      setIsAnalyzing(false);
    }

    if (hasFailures) {
      setErrorMessage("Some files could not be analyzed. Ready files can still be moved.");
    }
  };

  useEffect(() => {
    const hasQueued = items.some((item) => item.analysisStatus === "queued");
    if (hasQueued && !isAnalyzing) {
      void runAnalyzeQueue();
    }
  }, [items, isAnalyzing]);

  const openWithPaths = async (paths: string[]) => {
    const selectedPaths = normalizeSelectedPaths(paths);
    if (selectedPaths.length === 0) {
      return;
    }

    resetResumeDismissed();
    setModalOpen(true);
    setErrorMessage(null);

    setItems((state) => {
      const existingPaths = new Set(state.map((item) => item.currentPath));
      const queuedItems = selectedPaths
        .filter((path) => !existingPaths.has(path))
        .map((path) => buildQueuedItem(path, categories, defaultFolder));
      return queuedItems.length > 0 ? [...state, ...queuedItems] : state;
    });

    void runAnalyzeQueue();
  };

  useOrganizeDragDrop({ openWithPaths, setIsDraggingOver, setLastNativeDropAt });

  const handleAddFiles = async () => {
    const selected = await tauriClient.pickFilesForOrganize();
    await openWithPaths(selected);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (Date.now() - lastNativeDropAt < 300) {
      return;
    }

    const dropped = Array.from(event.dataTransfer.files)
      .map((file) => {
        const fileWithPath = file as File & { path?: string };
        return fileWithPath.path;
      })
      .filter((value): value is string => Boolean(value));

    if (dropped.length === 0) {
      setErrorMessage("Could not read dropped file paths. Try dropping directly into the app window or use Add Files.");
      return;
    }

    void openWithPaths(dropped);
  };

  const applyCategory = (itemId: string, categoryName: string) => {
    setItems((state) => state.map((item) => (
      item.id === itemId ? applyCategoryToItem(item, categoryName, categories, defaultFolder) : item
    )));
  };

  const applySuggestedName = (itemId: string, selectedName: string | null) => {
    setItems((state) => state.map((item) => (
      item.id === itemId ? applySuggestedNameToItem(item, selectedName) : item
    )));
    setOpenSuggestionFor(null);
  };

  const retryAnalyzeItem = (itemId: string) => {
    resetResumeDismissed();
    setItems((state) => state.map((item) => (
      item.id === itemId ? { ...item, analysisStatus: "queued", analysisError: null } : item
    )));
    void runAnalyzeQueue();
  };

  const cancelItem = (itemId: string) => {
    cancelItemById(itemId);
  };

  const cancelOrganize = () => {
    cancelPendingItems();
  };

  const clearCompleted = () => {
    clearCompletedItems();
  };

  const closeModal = () => {
    const hasActiveQueue = itemsRef.current.some(
      (item) => item.analysisStatus === "queued" || item.analysisStatus === "processing",
    );

    setModalOpen(false);

    // If all work is settled (no queue/processing), close acts like session cleanup.
    if (!hasActiveQueue) {
      clearAll();
    }
  };

  const moveSingleItem = async (item: OrganizePreviewItem) => {
    if (item.analysisStatus !== "completed" || item.moveStatus === "processing" || item.moveStatus === "completed") {
      return;
    }

    setItems((state) => state.map((entry) => (
      entry.id === item.id ? { ...entry, moveStatus: "processing" } : entry
    )));

    setErrorMessage(null);

    try {
      await tauriClient.moveFile({ sourcePath: item.currentPath, destinationPath: item.destinationPath });

      setItems((state) => state.map((entry) => (
        entry.id === item.id ? { ...entry, moveStatus: "completed" } : entry
      )));

      const selectedScore = item.topScores.find((score) => score.name === item.selectedCategory) ?? item.topScores[0];
      const moveLog: AutomationLog = {
        id: crypto.randomUUID(),
        itemType: "file",
        fileName: item.fileName,
        originalPath: item.currentPath,
        movedTo: item.destinationPath,
        chosenCategory: item.selectedCategory,
        score: selectedScore?.score ?? 0,
        allScores: item.topScores,
        timestamp: new Date().toISOString(),
        processingTimeMs: 0,
        status: "completed",
      };

      useLogStore.getState().appendLog(moveLog);
      await tauriClient.writeLog({ log: moveLog });
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Move failed";
      setErrorMessage(`Failed to move ${item.fileName}: ${reason}`);
      setItems((state) => state.map((entry) => (
        entry.id === item.id ? { ...entry, moveStatus: "failed" } : entry
      )));
    }
  };

  const undoSingleItem = async (item: OrganizePreviewItem) => {
    if (item.analysisStatus !== "completed" || item.moveStatus === "processing" || item.moveStatus !== "completed") {
      return;
    }

    setItems((state) => state.map((entry) => (
      entry.id === item.id ? { ...entry, moveStatus: "processing" } : entry
    )));

    setErrorMessage(null);

    try {
      await tauriClient.moveFile({ sourcePath: item.destinationPath, destinationPath: item.currentPath });

      setItems((state) => state.map((entry) => (
        entry.id === item.id ? { ...entry, moveStatus: "idle" } : entry
      )));
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Undo failed";
      setErrorMessage(`Failed to undo ${item.fileName}: ${reason}`);
      setItems((state) => state.map((entry) => (
        entry.id === item.id ? { ...entry, moveStatus: "failed" } : entry
      )));
    }
  };

  const moveAllPending = async () => {
    const pendingItems = itemsRef.current.filter((item) => item.analysisStatus === "completed" && item.moveStatus !== "completed");
    for (const item of pendingItems) {
      // Keep sequential execution so errors are easier to trace for a specific file.
      // eslint-disable-next-line no-await-in-loop
      await moveSingleItem(item);
    }
  };

  const undoAllMoved = async () => {
    const movedItems = itemsRef.current.filter((item) => item.analysisStatus === "completed" && item.moveStatus === "completed");
    for (const item of movedItems) {
      // Keep sequential execution so undo errors are attributable to the exact file.
      // eslint-disable-next-line no-await-in-loop
      await undoSingleItem(item);
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
    handleAddFiles,
    handleDrop,
    closeModal,
    openModal: () => setModalOpen(true),
    setOpenSettingsWindow,
    toggleSuggestionFor: (itemId: string) => {
      setOpenSuggestionFor((state) => (state === itemId ? null : itemId));
    },
    applyCategory,
    applySuggestedName,
    cancelItem,
    cancelOrganize,
    clearCompleted,
    retryAnalyzeItem,
    moveSingleItem,
    undoSingleItem,
    moveAllPending,
    undoAllMoved,
  };
}
