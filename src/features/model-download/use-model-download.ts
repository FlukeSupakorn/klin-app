import { useCallback, useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { tauriClient } from "@/services/tauri-client";
import { logger } from "@/lib/logger";
import type { ModelEntry } from "./available-models";
import type { ModelDownloadProgressPayload, ModelDownloadSlot } from "@/types/ipc";

type RowStatus = "pending" | "downloading" | "verified" | "done" | "error";

export interface ModelDownloadRowState {
  status: RowStatus;
  progress: number;
}

type StateBySlot = Record<ModelDownloadSlot, ModelDownloadRowState>;

const initialState: StateBySlot = {
  chat: { status: "pending", progress: 0 },
  embed: { status: "pending", progress: 0 },
  mmproj: { status: "pending", progress: 0 },
};

export function useModelDownload() {
  const [rows, setRows] = useState<StateBySlot>(initialState);
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    void listen<ModelDownloadProgressPayload>("model-download://progress", (event) => {
      const { slot, downloaded, total } = event.payload;
      const progress = total > 0 ? Math.min(100, Math.round((downloaded / total) * 100)) : 0;
      setRows((prev) => ({
        ...prev,
        [slot]: { status: "downloading", progress },
      }));
    })
      .then((fn) => {
        unlisten = fn;
      })
      .catch((listenError) => {
        logger.error("[model-download] listen(model-download://progress)", listenError);
      });

    return () => {
      unlisten?.();
    };
  }, []);

  const reset = useCallback(() => {
    setRows(initialState);
    setError("");
  }, []);

  const cancel = useCallback(async (slot: ModelDownloadSlot) => {
    await tauriClient.cancelModelDownload(slot);
  }, []);

  const downloadQueue = useCallback(async (models: ModelEntry[]) => {
    setIsDownloading(true);
    setError("");

    try {
      const modelDir = await tauriClient.getModelDir();
      for (const model of models) {
        setRows((prev) => ({
          ...prev,
          [model.slot]: { status: "downloading", progress: 0 },
        }));

        const dest = `${modelDir}\\${model.filename}`;
        logger.info(`[frontend] download ${model.slot} model from ${model.url} to ${dest}`);
        await tauriClient.downloadModel({
          url: model.url,
          destFilename: model.filename,
          slot: model.slot,
          expectedSha256: model.sha256,
          expectedSize: model.sizeBytes,
        });

        setRows((prev) => ({
          ...prev,
          [model.slot]: { status: "verified", progress: 100 },
        }));
        await tauriClient.writeModelConfig(model.slot, model.filename, model.sha256);
        setRows((prev) => ({
          ...prev,
          [model.slot]: { status: "done", progress: 100 },
        }));
      }
    } catch (downloadError) {
      const message = downloadError instanceof Error ? downloadError.message : String(downloadError);
      setError(message);
      logger.error("[model-download] download failed", downloadError);
      throw downloadError;
    } finally {
      setIsDownloading(false);
    }
  }, []);

  return {
    rows,
    isDownloading,
    error,
    downloadQueue,
    cancel,
    retry: reset,
  };
}
