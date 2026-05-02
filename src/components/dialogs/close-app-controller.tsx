import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { appClient } from "@/services/app-client";
import { CloseAppModal } from "./close-app-modal";

interface CloseAppControllerProps {
  mode?: "modal" | "quit-immediately";
}

export function CloseAppController({ mode = "modal" }: CloseAppControllerProps) {
  const [showCloseModal, setShowCloseModal] = useState(false);

  useEffect(() => {
    let unlistener: (() => void) | null = null;
    void (async () => {
      unlistener = await listen("window://close-requested", () => {
        if (mode === "quit-immediately") {
          void appClient.exitApp();
          return;
        }
        setShowCloseModal(true);
      });
    })();
    return () => { unlistener?.(); };
  }, [mode]);

  if (mode === "quit-immediately") {
    return null;
  }

  return (
    <CloseAppModal
      open={showCloseModal}
      onMinimize={async () => { await appClient.minimizeToTray(); setShowCloseModal(false); }}
      onQuit={async () => { await appClient.exitApp(); }}
      onCancel={() => { setShowCloseModal(false); }}
    />
  );
}
