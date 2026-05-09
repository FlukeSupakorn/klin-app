import { tauriClient } from "@/services/tauri-client";
import { categoryManagementService } from "@/services/category-management-service";
import { useCategoryStore } from "@/stores/use-category-store";
import { useCategoryManagementStore } from "@/stores/use-category-management-store";
import { useHistoryStore } from "@/stores/use-history-store";
import { usePrivacyStore } from "@/stores/use-privacy-store";
import { useAutomationStore } from "@/stores/use-automation-store";
import { logger } from "@/lib/logger";

let didBootstrap = false;

export interface BootstrapOptions {
  onStep?: (msg: string) => void;
}

const WORKER_INIT_TIMEOUT_MS = 4000;

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T | null> {
  return Promise.race([
    p.then((v) => v as T | null),
    new Promise<T | null>((resolve) => {
      setTimeout(() => {
        logger.warn(`[bootstrap] ${label} timed out after ${ms}ms`);
        resolve(null);
      }, ms);
    }),
  ]);
}

export async function bootstrapAppData(options: BootstrapOptions = {}) {
  if (didBootstrap) {
    options.onStep?.("Ready");
    return;
  }

  const step = (msg: string) => options.onStep?.(msg);

  step("Loading categories");
  const [categories, logs] = await Promise.all([tauriClient.getCategories(), tauriClient.listHistory()]);

  const categoryState = useCategoryStore.getState();
  const historyState = useHistoryStore.getState();

  if (JSON.stringify(categoryState.categories) !== JSON.stringify(categories)) {
    categoryState.setCategories(categories);
  }

  if (JSON.stringify(historyState.logs) !== JSON.stringify(logs)) {
    historyState.setLogs(logs);
  }

  step("Syncing with worker");
  await withTimeout(
    categoryManagementService
      .initializeFromWorker()
      .catch((e) => logger.warn("[bootstrap] category init from worker failed", e)),
    WORKER_INIT_TIMEOUT_MS,
    "category init from worker",
  );
  categoryManagementService.syncToAutomationStores();

  step("Preparing folders");
  const categoryFolderPaths = useCategoryManagementStore
    .getState()
    .categories
    .filter((c) => c.enabled && c.folderPath.trim().length > 0)
    .map((c) => c.folderPath);
  if (categoryFolderPaths.length > 0) {
    await tauriClient.ensureCategoryFolders(categoryFolderPaths).catch((e) => logger.warn("[bootstrap] ensure category folders failed", e));
  }

  step("Loading automation");
  const automationConfig = await tauriClient.loadAutomationConfig().catch((e) => { logger.warn("[bootstrap] load automation config failed", e); return null; });
  if (automationConfig && automationConfig.watched_folders.length > 0) {
    useAutomationStore.getState().setWatchedFolders(automationConfig.watched_folders);
  }

  step("Loading preferences");
  await usePrivacyStore.getState().hydrateFromApi().catch((e) => logger.warn("[bootstrap] privacy settings hydration failed", e));

  step("Ready");
  didBootstrap = true;
}
