import { tauriClient } from "@/services/tauri-client";
import { useCategoryStore } from "@/stores/use-category-store";
import { useLogStore } from "@/stores/use-log-store";

let didBootstrap = false;

export async function bootstrapAppData() {
  if (didBootstrap) {
    return;
  }

  const [categories, logs] = await Promise.all([tauriClient.getCategories(), tauriClient.listLogs()]);

  const categoryState = useCategoryStore.getState();
  const logState = useLogStore.getState();

  if (JSON.stringify(categoryState.categories) !== JSON.stringify(categories)) {
    categoryState.setCategories(categories);
  }

  if (JSON.stringify(logState.logs) !== JSON.stringify(logs)) {
    logState.setLogs(logs);
  }

  didBootstrap = true;
}
