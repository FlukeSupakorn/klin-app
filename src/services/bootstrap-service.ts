import { tauriClient } from "@/services/tauri-client";
import { categoryManagementService } from "@/services/category-management-service";
import { useCategoryStore } from "@/stores/use-category-store";
import { useCategoryManagementStore } from "@/stores/use-category-management-store";
import { useHistoryStore } from "@/stores/use-history-store";
import { usePrivacyStore } from "@/stores/use-privacy-store";
import { useAutomationStore } from "@/stores/use-automation-store";

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

  await categoryManagementService.initializeFromWorker().catch(() => undefined);
  categoryManagementService.syncToAutomationStores();

  const categoryFolderPaths = useCategoryManagementStore
    .getState()
    .categories
    .filter((c) => c.enabled && c.folderPath.trim().length > 0)
    .map((c) => c.folderPath);
  if (categoryFolderPaths.length > 0) {
    await tauriClient.ensureCategoryFolders(categoryFolderPaths).catch(() => undefined);
  }

  const automationConfig = await tauriClient.loadAutomationConfig().catch(() => null);
  if (automationConfig && automationConfig.watched_folders.length > 0) {
    useAutomationStore.getState().setWatchedFolders(automationConfig.watched_folders);
  }

  await usePrivacyStore.getState().hydrateFromApi().catch(() => undefined);

  didBootstrap = true;
}
