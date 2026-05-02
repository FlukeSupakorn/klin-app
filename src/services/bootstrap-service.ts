import { tauriClient } from "@/services/tauri-client";
import { categoryManagementService } from "@/services/category-management-service";
import { useCategoryStore } from "@/stores/use-category-store";
import { useCategoryManagementStore } from "@/stores/use-category-management-store";
import { useHistoryStore } from "@/stores/use-history-store";
import { usePrivacyStore } from "@/stores/use-privacy-store";
import { useAutomationStore } from "@/stores/use-automation-store";
import { logger } from "@/lib/logger";

let didBootstrap = false;

export async function bootstrapAppData() {
  if (didBootstrap) {
    return;
  }

  const [categories, logs] = await Promise.all([tauriClient.getCategories(), tauriClient.listHistory()]);

  const categoryState = useCategoryStore.getState();
  const historyState = useHistoryStore.getState();

  if (JSON.stringify(categoryState.categories) !== JSON.stringify(categories)) {
    categoryState.setCategories(categories);
  }

  if (JSON.stringify(historyState.logs) !== JSON.stringify(logs)) {
    historyState.setLogs(logs);
  }

  await categoryManagementService.initializeFromWorker().catch((e) => logger.warn("[bootstrap] category init from worker failed", e));
  categoryManagementService.syncToAutomationStores();

  const categoryFolderPaths = useCategoryManagementStore
    .getState()
    .categories
    .filter((c) => c.enabled && c.folderPath.trim().length > 0)
    .map((c) => c.folderPath);
  if (categoryFolderPaths.length > 0) {
    await tauriClient.ensureCategoryFolders(categoryFolderPaths).catch((e) => logger.warn("[bootstrap] ensure category folders failed", e));
  }

  const automationConfig = await tauriClient.loadAutomationConfig().catch((e) => { logger.warn("[bootstrap] load automation config failed", e); return null; });
  if (automationConfig && automationConfig.watched_folders.length > 0) {
    useAutomationStore.getState().setWatchedFolders(automationConfig.watched_folders);
  }

  await usePrivacyStore.getState().hydrateFromApi().catch((e) => logger.warn("[bootstrap] privacy settings hydration failed", e));

  didBootstrap = true;
}
