import { invoke } from "@tauri-apps/api/core";

class AppClient {
  async exitApp(): Promise<void> {
    return invoke("exit_app");
  }

  async consumePendingCloseRequest(): Promise<boolean> {
    return invoke("consume_pending_close_request");
  }

  async minimizeToTray(): Promise<void> {
    return invoke("minimize_to_tray");
  }
}

export const appClient = new AppClient();
