/**
 * Queue and analysis management for file organization workflow
 *
 * Responsibilities:
 * - Managing the analysis queue for files
 * - File picking and adding
 * - Retry logic for failed analyses
 * - Queue execution and cancellation
 */

import { useCallback, useEffect, useRef } from "react";
import { organizeApiService } from "@/services/organize-api-service";
import { tauriClient } from "@/services/tauri-client";
import { usePrivacyStore } from "@/stores/use-privacy-store";
import { useCategoryManagementStore } from "@/stores/use-category-management-store";
import { isAbortError } from "@/lib/error-utils";
import { getPathName } from "@/lib/path-utils";
import type { OrganizePreviewItem } from "@/types/domain";
import {
  buildQueuedItem,
  normalizeSelectedPaths,
} from "@/features/dashboard/organize-files-panel/organize-workflow-utils";

const LOCK_NOTICE_DETAILS_SEPARATOR = "\n__DETAILS__\n";

export interface UseOrganizeQueueReturn {
  handleAddFiles: () => Promise<void>;
  retryAnalyzeItem: (itemId: string) => void;
  cancelItem: (itemId: string) => void;
  cancelOrganize: () => void;
  runAnalyzeQueue: () => Promise<void>;
  openWithPaths: (paths: string[]) => Promise<void>;
}

interface QueueDependencies {
  items: OrganizePreviewItem[];
  isAnalyzing: boolean;
  categories: any[];
  defaultFolder: string;
  setItems: (fn: (state: OrganizePreviewItem[]) => OrganizePreviewItem[]) => void;
  setModalOpen: (open: boolean) => void;
  setIsAnalyzing: (analyzing: boolean) => void;
  setErrorMessage: (message: string | null) => void;
  resetResumeDismissed: () => void;
  cancelItemById: (itemId: string) => void;
  cancelPendingItems: () => void;
}

export function useOrganizeQueue(deps: QueueDependencies): UseOrganizeQueueReturn {
  const {
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
  } = deps;

  const itemsRef = useRef<OrganizePreviewItem[]>(items);
  itemsRef.current = items;
  const isQueueRunningRef = useRef(false);
  const activeAnalyzeRef = useRef<{ itemId: string; controller: AbortController } | null>(null);
  const isPickingFilesRef = useRef(false);

  const runAnalyzeQueue = useCallback(async () => {
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

          console.info("[organize] analysis queued -> processing", {
            itemId: nextQueuedItem.id,
            currentPath: nextQueuedItem.currentPath,
          });

          // Keep sequential analysis so queue progress is deterministic in the modal.
          // eslint-disable-next-line no-await-in-loop
          const analyzedItem = await organizeApiService.analyzeOne(
            nextQueuedItem.currentPath,
            categories,
            controller.signal,
          );

          console.info("[organize] analysis completed", {
            itemId: nextQueuedItem.id,
            currentPath: nextQueuedItem.currentPath,
            status: analyzedItem.analysisStatus,
            selectedCategory: analyzedItem.selectedCategory,
            destinationPath: analyzedItem.destinationPath,
          });

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
            console.info("[organize] analysis aborted", {
              itemId: nextQueuedItem.id,
              currentPath: nextQueuedItem.currentPath,
            });
            activeAnalyzeRef.current = null;
            continue;
          }

          hasFailures = true;
          const reason = error instanceof Error ? error.message : "Unknown analysis error";
          console.error("[organize] analysis failed", {
            itemId: nextQueuedItem.id,
            currentPath: nextQueuedItem.currentPath,
            reason,
          });

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
  }, [categories, setItems, setIsAnalyzing, setErrorMessage]);

  useEffect(() => {
    const hasQueued = items.some((item) => item.analysisStatus === "queued");
    if (hasQueued && !isAnalyzing) {
      void runAnalyzeQueue();
    }
  }, [items, isAnalyzing, runAnalyzeQueue]);

  const openWithPaths = useCallback(async (paths: string[]) => {
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
      const nextState = queuedItems.length > 0 ? [...state, ...queuedItems] : state;
      itemsRef.current = nextState;
      return nextState;
    });

    await runAnalyzeQueue();
  }, [categories, defaultFolder, setItems, setModalOpen, setErrorMessage, resetResumeDismissed, runAnalyzeQueue]);

  const handleAddFiles = useCallback(async () => {
    if (isPickingFilesRef.current) {
      return;
    }

    isPickingFilesRef.current = true;
    try {
      const selected = await tauriClient.pickFilesForOrganize();
      await openWithPaths(selected);
    } finally {
      isPickingFilesRef.current = false;
    }
  }, [openWithPaths]);

  const retryAnalyzeItem = useCallback((itemId: string) => {
    resetResumeDismissed();
    setItems((state) => state.map((item) => (
      item.id === itemId ? { ...item, analysisStatus: "queued", analysisError: null } : item
    )));
    void runAnalyzeQueue();
  }, [resetResumeDismissed, setItems, runAnalyzeQueue]);

  const cancelItem = useCallback((itemId: string) => {
    if (activeAnalyzeRef.current?.itemId === itemId) {
      activeAnalyzeRef.current.controller.abort();
      activeAnalyzeRef.current = null;
    }

    cancelItemById(itemId);
  }, [cancelItemById]);

  const cancelOrganize = useCallback(() => {
    if (activeAnalyzeRef.current) {
      activeAnalyzeRef.current.controller.abort();
      activeAnalyzeRef.current = null;
    }

    cancelPendingItems();
  }, [cancelPendingItems]);

  return {
    handleAddFiles,
    retryAnalyzeItem,
    cancelItem,
    cancelOrganize,
    runAnalyzeQueue,
    openWithPaths,
  };
}
