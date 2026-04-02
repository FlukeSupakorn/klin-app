import { invoke } from "@tauri-apps/api/core";

class AppClient {
  async exitApp(): Promise<void> {
    return invoke("exit_app");
  }

  async minimizeToTray(): Promise<void> {
    return invoke("minimize_to_tray");
  }
}

export const appClient = new AppClient();
