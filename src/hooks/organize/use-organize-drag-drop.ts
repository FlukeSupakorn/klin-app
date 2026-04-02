import { useEffect, useRef } from "react";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";

interface UseOrganizeDragDropParams {
  openWithPaths: (paths: string[]) => Promise<void>;
  setIsDraggingOver: (value: boolean) => void;
  setLastNativeDropAt: (value: number) => void;
}

export function useOrganizeDragDrop({
  openWithPaths,
  setIsDraggingOver,
  setLastNativeDropAt,
}: UseOrganizeDragDropParams) {
  const openWithPathsRef = useRef(openWithPaths);

  useEffect(() => {
    openWithPathsRef.current = openWithPaths;
  }, [openWithPaths]);

  useEffect(() => {
    const appWindow = getCurrentWebviewWindow();
    let unlistenNative: (() => void) | undefined;
    let unlistenLegacyDrop: (() => void) | undefined;
    let unlistenLegacyHover: (() => void) | undefined;
    let unlistenLegacyCancelled: (() => void) | undefined;

    const registerError = (label: string, error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[drag-drop] ${label}: ${message}`);
    };

    void appWindow
      .onDragDropEvent((event) => {
        if (event.payload.type === "over" || event.payload.type === "enter") {
          setIsDraggingOver(true);
          return;
        }

        if (event.payload.type === "leave") {
          setIsDraggingOver(false);
          return;
        }

        if (event.payload.type === "drop") {
          setIsDraggingOver(false);
          setLastNativeDropAt(Date.now());
          const paths = event.payload.paths;
          if (paths && paths.length > 0) {
            void openWithPathsRef.current(paths);
          }
        }
      })
      .then((fn) => {
        unlistenNative = fn;
      })
      .catch((error) => {
        registerError("onDragDropEvent", error);
      });

    void listen<string[]>("tauri://file-drop", (event) => {
      const paths = Array.isArray(event.payload) ? event.payload : [];
      setIsDraggingOver(false);
      setLastNativeDropAt(Date.now());
      if (paths.length > 0) {
        void openWithPathsRef.current(paths);
      }
    })
      .then((fn) => {
        unlistenLegacyDrop = fn;
      })
      .catch((error) => {
        registerError("listen(tauri://file-drop)", error);
      });

    void listen("tauri://file-drop-hover", () => {
      setIsDraggingOver(true);
    })
      .then((fn) => {
        unlistenLegacyHover = fn;
      })
      .catch((error) => {
        registerError("listen(tauri://file-drop-hover)", error);
      });

    void listen("tauri://file-drop-cancelled", () => {
      setIsDraggingOver(false);
    })
      .then((fn) => {
        unlistenLegacyCancelled = fn;
      })
      .catch((error) => {
        registerError("listen(tauri://file-drop-cancelled)", error);
      });

    const onWindowDragEnter = (event: DragEvent) => {
      const hasFiles = event.dataTransfer?.types.includes("Files");
      if (!hasFiles) {
        return;
      }

      event.preventDefault();
      setIsDraggingOver(true);
    };

    const onWindowDragOver = (event: DragEvent) => {
      const hasFiles = event.dataTransfer?.types.includes("Files");
      if (!hasFiles) {
        return;
      }

      event.preventDefault();
      setIsDraggingOver(true);
    };

    const onWindowDragLeave = (event: DragEvent) => {
      event.preventDefault();
      setIsDraggingOver(false);
    };

    const onWindowDrop = (event: DragEvent) => {
      event.preventDefault();
      setIsDraggingOver(false);
    };

    window.addEventListener("dragenter", onWindowDragEnter);
    window.addEventListener("dragover", onWindowDragOver);
    window.addEventListener("dragleave", onWindowDragLeave);
    window.addEventListener("drop", onWindowDrop);

    return () => {
      unlistenNative?.();
      unlistenLegacyDrop?.();
      unlistenLegacyHover?.();
      unlistenLegacyCancelled?.();
      window.removeEventListener("dragenter", onWindowDragEnter);
      window.removeEventListener("dragover", onWindowDragOver);
      window.removeEventListener("dragleave", onWindowDragLeave);
      window.removeEventListener("drop", onWindowDrop);
    };
  }, [setIsDraggingOver, setLastNativeDropAt]);
}
