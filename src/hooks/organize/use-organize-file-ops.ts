/**
 * File operation management for file organization workflow
 *
 * Responsibilities:
 * - Moving files to their destinations
 * - Undoing file moves
 * - Bulk operations (moveAll, undoAll)
 * - Error handling for file operations
 */

import { useCallback, useRef } from "react";
import { organizeApiService } from "@/services/organize-api-service";
import { tauriClient } from "@/services/tauri-client";
import { useCategoryManagementStore } from "@/stores/use-category-management-store";
import { splitDestinationPath, normalizePath } from "@/lib/path-utils";
import type { OrganizePreviewItem } from "@/types/domain";

export interface UseOrganizeFileOpsReturn {
  moveSingleItem: (item: OrganizePreviewItem) => Promise<void>;
  undoSingleItem: (item: OrganizePreviewItem) => Promise<void>;
  moveAllPending: () => Promise<void>;
  undoAllMoved: () => Promise<void>;
  handleDrop: (event: React.DragEvent<HTMLDivElement>) => void;
}

interface FileOpsDependencies {
  items: OrganizePreviewItem[];
  lastNativeDropAt: number;
  categories: any[];
  setItems: (fn: (state: OrganizePreviewItem[]) => OrganizePreviewItem[]) => void;
  setErrorMessage: (message: string | null) => void;
  setLastNativeDropAt: (time: number) => void;
}

export function useOrganizeFileOps(deps: FileOpsDependencies): UseOrganizeFileOpsReturn {
  const {
    items,
    lastNativeDropAt,
    categories,
    setItems,
    setErrorMessage,
    setLastNativeDropAt,
  } = deps;

  const itemsRef = useRef<OrganizePreviewItem[]>(items);
  itemsRef.current = items;

  const isSamePath = useCallback((left: string, right: string) => {
    return normalizePath(left) === normalizePath(right);
  }, []);

  const moveSingleItem = useCallback(async (item: OrganizePreviewItem) => {
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

      window.dispatchEvent(new Event("klin:history-updated"));
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Move failed";
      setErrorMessage(`Failed to move ${item.fileName}: ${reason}`);
      setItems((state) => state.map((entry) => (
        entry.id === item.id ? { ...entry, moveStatus: "failed" } : entry
      )));
    }
  }, [categories, isSamePath, setItems, setErrorMessage]);

  const undoSingleItem = useCallback(async (item: OrganizePreviewItem) => {
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
  }, [setItems, setErrorMessage]);

  const moveAllPending = useCallback(async () => {
    const pendingItems = itemsRef.current.filter((item) => item.analysisStatus === "completed" && item.moveStatus !== "completed");
    for (const item of pendingItems) {
      // Keep sequential execution so errors are easier to trace for a specific file.
      // eslint-disable-next-line no-await-in-loop
      await moveSingleItem(item);
    }
  }, [moveSingleItem]);

  const undoAllMoved = useCallback(async () => {
    const movedItems = itemsRef.current.filter((item) => item.analysisStatus === "completed" && item.moveStatus === "completed");
    for (const item of movedItems) {
      // Keep sequential execution so undo errors are attributable to the exact file.
      // eslint-disable-next-line no-await-in-loop
      await undoSingleItem(item);
    }
  }, [undoSingleItem]);

  const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
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

    // Note: This would need to be handled by calling openWithPaths from queue
    // For now, just trigger the error
    setLastNativeDropAt(Date.now());
  }, [lastNativeDropAt, setErrorMessage, setLastNativeDropAt]);

  return {
    moveSingleItem,
    undoSingleItem,
    moveAllPending,
    undoAllMoved,
    handleDrop,
  };
}
