import { organizeApiService } from "@/services/organize-api-service";
import { categoryManagementService } from "@/services/category-management-service";
import { tauriClient } from "@/services/tauri-client";
import { useCategoryManagementStore } from "@/stores/use-category-management-store";
import { useHistoryStore } from "@/stores/use-history-store";
import { usePrivacyStore } from "@/stores/use-privacy-store";
import { normalizePath } from "@/lib/path-utils";
import type { AutomationJob, AutomationLog } from "@/types/domain";

export async function processAutomationJob(job: AutomationJob): Promise<void> {
  const start = performance.now();

  try {
    const privacyStore = usePrivacyStore.getState();
    if (privacyStore.isLocked(job.filePath)) {
      return;
    }

    let enabledCategories = useCategoryManagementStore
      .getState()
      .categories.filter((category) => category.enabled);

    if (enabledCategories.length === 0) {
      await categoryManagementService.refreshCategoriesFromWorker().catch(() => undefined);
      categoryManagementService.syncToAutomationStores();
      enabledCategories = useCategoryManagementStore
        .getState()
        .categories.filter((category) => category.enabled);
    }

    const analyzed = await organizeApiService.analyzeOne(job.filePath, enabledCategories);
    const topScore = analyzed.topScores[0];
    const processingTimeMs = Math.round(performance.now() - start);

    if (analyzed.analysisStatus === "failed" || !topScore) {
      const failedLog: AutomationLog = {
        id: crypto.randomUUID(),
        itemType: "file",
        fileName: job.fileName,
        originalPath: job.filePath,
        movedTo: "",
        chosenCategory: analyzed.selectedCategory,
        score: analyzed.confidence,
        allScores: analyzed.topScores,
        timestamp: new Date().toISOString(),
        processingTimeMs,
        status: "failed",
        errorMessage: analyzed.analysisError ?? "Worker analysis failed",
      };

      useHistoryStore.getState().appendLog(failedLog);
      return;
    }

    const shouldMove = normalizePath(analyzed.currentPath) !== normalizePath(analyzed.destinationPath);
    if (shouldMove) {
      await tauriClient.moveFile({
        sourcePath: analyzed.currentPath,
        destinationPath: analyzed.destinationPath,
      });

      // Record the confirmed move in klin-worker so it appears in history as action="moved".
      // Race against a timeout so a slow/hung response never blocks the queue.
      if (analyzed.workerFileId) {
        const matchedCategory = enabledCategories.find(
          (cat) => cat.name === analyzed.selectedCategory,
        );
        if (matchedCategory) {
          const applyPromise = organizeApiService.applyDecision({
            fileId: analyzed.workerFileId,
            selectedName: null,
            selectedCategory: {
              id: matchedCategory.id,
              name: matchedCategory.name,
              score: topScore.score,
            },
          });
          const timeoutPromise = new Promise<void>((_, reject) =>
            setTimeout(() => reject(new Error("applyDecision timeout")), 8_000),
          );
          await Promise.race([applyPromise, timeoutPromise]).catch(() => undefined);
        }
      }
    }

    const log: AutomationLog = {
      id: crypto.randomUUID(),
      itemType: "file",
      fileName: analyzed.fileName,
      originalPath: analyzed.currentPath,
      movedTo: shouldMove ? analyzed.destinationPath : analyzed.currentPath,
      chosenCategory: analyzed.selectedCategory,
      score: topScore.score,
      allScores: analyzed.topScores,
      timestamp: new Date().toISOString(),
      processingTimeMs,
      status: "completed",
    };

    useHistoryStore.getState().appendLog(log);
    window.dispatchEvent(new Event("klin:history-updated"));
  } catch (error) {
    const processingTimeMs = Math.round(performance.now() - start);
    const failedLog: AutomationLog = {
      id: crypto.randomUUID(),
      itemType: "file",
      fileName: job.fileName,
      originalPath: job.filePath,
      movedTo: "",
      chosenCategory: "Uncategorized",
      score: 0,
      allScores: [],
      timestamp: new Date().toISOString(),
      processingTimeMs,
      status: "failed",
      errorMessage: error instanceof Error ? error.message : "Automation job failed",
    };

    useHistoryStore.getState().appendLog(failedLog);
  }
}
