import { useEffect, useMemo, useRef } from "react";
import type { DragEvent } from "react";
import { organizeApiService } from "@/services/organize-api-service";
import { tauriClient } from "@/services/tauri-client";
import { useCategoryManagementStore } from "@/stores/use-category-management-store";
import { useLogStore } from "@/stores/use-log-store";
import { usePrivacyStore } from "@/stores/use-privacy-store";
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

function isAbortError(error: unknown): boolean {
  if (error instanceof DOMException && error.name === "AbortError") {
    return true;
  }

  if (error && typeof error === "object" && "name" in error) {
    return (error as { name?: string }).name === "AbortError";
  }

  if (error instanceof Error) {
    return /abort/i.test(error.message);
  }

  return false;
}

function getPathName(path: string): string {
  const name = path.split(/[\\/]/).pop()?.trim();
  return name && name.length > 0 ? name : path;
}

const LOCK_NOTICE_DETAILS_SEPARATOR = "\n__DETAILS__\n";

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
  const activeAnalyzeRef = useRef<{ itemId: string; controller: AbortController } | null>(null);

  const splitDestinationPath = (destinationPath: string) => {
    const slashIndex = Math.max(destinationPath.lastIndexOf("/"), destinationPath.lastIndexOf("\\"));
    if (slashIndex < 0) {
      return {
        folderPath: "",
        fileName: destinationPath,
      };
    }

    return {
      folderPath: destinationPath.slice(0, slashIndex),
      fileName: destinationPath.slice(slashIndex + 1),
    };
  };

  const normalizePathForCompare = (value: string) => value.replace(/\\/g, "/").replace(/\/+$/g, "").toLowerCase();

  const buildDestinationPath = (folderPath: string, fileName: string) => {
    const trimmedFolder = folderPath.trim();
    const trimmedFileName = fileName.trim();
    if (!trimmedFolder) {
      return trimmedFileName;
    }

    const separator = trimmedFolder.includes("\\") ? "\\" : "/";
    return `${trimmedFolder}${separator}${trimmedFileName}`;
  };

  const isSamePath = (left: string, right: string) => normalizePathForCompare(left) === normalizePathForCompare(right);

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
          const controller = new AbortController();
          activeAnalyzeRef.current = {
            itemId: nextQueuedItem.id,
            controller,
          };

          // Keep sequential analysis so queue progress is deterministic in the modal.
          // eslint-disable-next-line no-await-in-loop
          const analyzedItem = await organizeApiService.analyzeOne(
            nextQueuedItem.currentPath,
            categories,
            controller.signal,
          );

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
                lastMovedFromPath: item.moveStatus === "completed" ? item.lastMovedFromPath ?? item.currentPath : null,
                lastMovedToPath: item.moveStatus === "completed" ? item.lastMovedToPath ?? item.destinationPath : null,
              }
              : item
          )));

          if (analyzedItem.analysisStatus === "failed") {
            hasFailures = true;
          }
        } catch (error) {
          const aborted = isAbortError(error);
          if (aborted) {
            activeAnalyzeRef.current = null;
            continue;
          }

          hasFailures = true;
          const reason = error instanceof Error ? error.message : "Unknown analysis error";

          setItems((state) => state.map((item) => (
            item.id === nextQueuedItem.id
              ? { ...item, analysisStatus: "failed", analysisError: reason }
              : item
          )));
        } finally {
          if (activeAnalyzeRef.current?.itemId === nextQueuedItem.id) {
            activeAnalyzeRef.current = null;
          }
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

    const privacyStore = usePrivacyStore.getState();
    const blocked: Array<{ source: "file" | "folder"; fileName: string; lockedByName: string }> = [];
    const allowed: string[] = [];
    for (const path of selectedPaths) {
      const match = privacyStore.getLockMatch(path);
      if (match) {
        blocked.push({
          source: match.source,
          fileName: getPathName(path),
          lockedByName: getPathName(match.lockedPath),
        });
        continue;
      }

      allowed.push(path);
    }

    if (blocked.length > 0) {
      const previewNames = blocked.slice(0, 2).map((item) => item.fileName);
      const remaining = blocked.length - previewNames.length;
      const head = previewNames.join(", ");
      const summary = `Skipped ${blocked.length} locked file(s): ${head}${remaining > 0 ? ` +${remaining} more` : ""}`;
      const detailLines = blocked.map((item) => (
        item.source === "folder"
          ? `${item.fileName} - locked by folder ${item.lockedByName}`
          : `${item.fileName} - locked file`
      ));
      const withDetails = `${summary}${LOCK_NOTICE_DETAILS_SEPARATOR}${detailLines.join("\n")}`;

      setErrorMessage(withDetails);
    }

    if (allowed.length === 0) {
      setModalOpen(true);
      return;
    }

    resetResumeDismissed();
    setModalOpen(true);
    if (blocked.length === 0) {
      setErrorMessage(null);
    }

    setItems((state) => {
      const existingPaths = new Set(state.map((item) => item.currentPath));
      const queuedItems = allowed
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

  const retryAnalyzeItem = (itemId: string) => {
    resetResumeDismissed();
    setItems((state) => state.map((item) => (
      item.id === itemId ? { ...item, analysisStatus: "queued", analysisError: null } : item
    )));
    void runAnalyzeQueue();
  };

  const cancelItem = (itemId: string) => {
    if (activeAnalyzeRef.current?.itemId === itemId) {
      activeAnalyzeRef.current.controller.abort();
      activeAnalyzeRef.current = null;
    }

    cancelItemById(itemId);
  };

  const cancelOrganize = () => {
    if (activeAnalyzeRef.current) {
      activeAnalyzeRef.current.controller.abort();
      activeAnalyzeRef.current = null;
    }

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

    if (isSamePath(item.currentPath, item.destinationPath)) {
      setErrorMessage(`No changes for ${item.fileName}. Rename or choose a different folder before moving.`);
      return;
    }

    setItems((state) => state.map((entry) => (
      entry.id === item.id ? { ...entry, moveStatus: "processing" } : entry
    )));

    setErrorMessage(null);

    try {
      const selectedScore = item.topScores.find((score) => score.name === item.selectedCategory) ?? item.topScores[0];
      const categoryByName = categories.find((category) => category.name === item.selectedCategory);
      const currentName = splitDestinationPath(item.currentPath).fileName;
      const destinationName = splitDestinationPath(item.destinationPath).fileName;
      const selectedNameForApi = item.suggestedName ?? (destinationName !== currentName ? destinationName : null);
      const selectedCategoryPayload = item.selectedCategory === "No category"
        ? null
        : {
          id: selectedScore?.categoryId ?? categoryByName?.id ?? "",
          name: item.selectedCategory,
          score: Number(((selectedScore?.score ?? 0) <= 1 ? (selectedScore?.score ?? 0) * 100 : (selectedScore?.score ?? 0)).toFixed(2)),
        };

      if (!item.workerFileId) {
        throw new Error("Missing worker file id. Please re-analyze this file before moving.");
      }

      if (selectedCategoryPayload && !selectedCategoryPayload.id) {
        throw new Error(`Missing category id for '${item.selectedCategory}'. Please re-analyze or reselect category.`);
      }

      // Persist the user decision in worker first, then perform local file move.
      await organizeApiService.applyDecision({
        fileId: item.workerFileId,
        selectedName: selectedNameForApi,
        selectedCategory: selectedCategoryPayload,
      });

      await tauriClient.moveFile({ sourcePath: item.currentPath, destinationPath: item.destinationPath });

      setItems((state) => state.map((entry) => (
        entry.id === item.id
          ? {
            ...entry,
            moveStatus: "completed",
            lastMovedFromPath: item.currentPath,
            lastMovedToPath: item.destinationPath,
          }
          : entry
      )));

      const chosenCategory = item.selectedCategory === "No category"
        ? "No category"
        : item.selectedCategory;
      const selectedScoreForLog = item.topScores.find((score) => score.name === chosenCategory) ?? item.topScores[0];
      const moveLog: AutomationLog = {
        id: crypto.randomUUID(),
        itemType: "file",
        fileName: item.fileName,
        originalPath: item.currentPath,
        movedTo: item.destinationPath,
        chosenCategory,
        score: selectedScoreForLog?.score ?? 0,
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

    const sourcePath = item.lastMovedToPath ?? item.destinationPath;
    const destinationPath = item.lastMovedFromPath ?? item.currentPath;

    setItems((state) => state.map((entry) => (
      entry.id === item.id ? { ...entry, moveStatus: "processing" } : entry
    )));

    setErrorMessage(null);

    try {
      await tauriClient.moveFile({ sourcePath, destinationPath });

      setItems((state) => state.map((entry) => (
        entry.id === item.id
          ? {
            ...entry,
            moveStatus: "idle",
            lastMovedFromPath: null,
            lastMovedToPath: null,
          }
          : entry
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
    updateFileName,
    setNoMoveCategory,
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
