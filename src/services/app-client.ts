import { invoke } from "@tauri-apps/api/core";

class AppClient {
  async exitApp(): Promise<void> {
    return invoke("exit_app");
  }
}

export const appClient = new AppClient();
