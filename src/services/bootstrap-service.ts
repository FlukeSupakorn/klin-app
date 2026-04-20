import { tauriClient } from "@/services/tauri-client";
import { categoryManagementService } from "@/services/category-management-service";
import { useCategoryStore } from "@/stores/use-category-store";
import { useHistoryStore } from "@/stores/use-history-store";
import { usePrivacyStore } from "@/stores/use-privacy-store";

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
  await usePrivacyStore.getState().hydrateFromApi().catch(() => undefined);

  didBootstrap = true;
}
