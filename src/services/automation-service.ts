import { organizeApiService } from "@/services/organize-api-service";
import { categoryManagementService } from "@/services/category-management-service";
import { tauriClient } from "@/services/tauri-client";
import { useCategoryManagementStore } from "@/stores/use-category-management-store";
import { useHistoryStore } from "@/stores/use-history-store";
import { usePrivacyStore } from "@/stores/use-privacy-store";
import type { AutomationJob, AutomationLog } from "@/types/domain";

function normalizePath(path: string): string {
  return path.replace(/\\/g, "/").replace(/\/+$/g, "").toLowerCase();
}

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
      await tauriClient.writeHistory({ log: failedLog });
      return;
    }

    const shouldMove = normalizePath(analyzed.currentPath) !== normalizePath(analyzed.destinationPath);
    if (shouldMove) {
      await tauriClient.moveFile({
        sourcePath: analyzed.currentPath,
        destinationPath: analyzed.destinationPath,
      });
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
    await tauriClient.writeHistory({ log });
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
    await tauriClient.writeHistory({ log: failedLog }).catch(() => undefined);
  }
}
