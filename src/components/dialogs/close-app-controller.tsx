import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { appClient } from "@/services/app-client";
import { CloseAppModal } from "./close-app-modal";

export function CloseAppController() {
  const [showCloseModal, setShowCloseModal] = useState(false);

  useEffect(() => {
    let unlistener: (() => void) | null = null;
    let disposed = false;
    let recoveryTimer: number | null = null;

    const showPendingCloseRequest = async () => {
      const shouldShow = await appClient.consumePendingCloseRequest().catch(() => false);
      if (!disposed && shouldShow) {
        setShowCloseModal(true);
      }
    };

    void (async () => {
      unlistener = await listen("window://close-requested", () => {
        setShowCloseModal(true);
        void appClient.consumePendingCloseRequest();
      });
      await showPendingCloseRequest();
      recoveryTimer = window.setInterval(() => {
        void showPendingCloseRequest();
      }, 500);
    })();
    return () => {
      disposed = true;
      if (recoveryTimer !== null) {
        window.clearInterval(recoveryTimer);
      }
      unlistener?.();
    };
  }, []);

  return (
    <CloseAppModal
      open={showCloseModal}
      onMinimize={async () => { await appClient.minimizeToTray(); setShowCloseModal(false); }}
      onQuit={async () => { await appClient.exitApp(); }}
      onCancel={() => { setShowCloseModal(false); }}
    />
  );
}
