import { useCallback, useMemo, useState } from "react";
import { useDownloadQueueStore } from "@/stores/use-download-queue-store";
import type { ModelEntry } from "./available-models";
import type { ModelDownloadSlot } from "@/types/ipc";

type RowStatus = "pending" | "downloading" | "verified" | "done" | "error";

export interface ModelDownloadRowState {
  status: RowStatus;
  progress: number;
}

type StateBySlot = Record<ModelDownloadSlot, ModelDownloadRowState>;

const initialRows: StateBySlot = {
  chat: { status: "pending", progress: 0 },
  embed: { status: "pending", progress: 0 },
  mmproj: { status: "pending", progress: 0 },
};

/**
 * Thin wrapper around the global download queue store that preserves the
 * legacy `rows` / `downloadQueue` / `error` / `retry` API used by the
 * onboarding ModelDownloadPage. Settings should subscribe to the store
 * directly (see useDownloadQueueStore) for richer per-model state.
 */
export function useModelDownload() {
  const queue = useDownloadQueueStore((s) => s.queue);
  const current = useDownloadQueueStore((s) => s.current);
  const progress = useDownloadQueueStore((s) => s.progress);
  const errors = useDownloadQueueStore((s) => s.errors);
  const completedIds = useDownloadQueueStore((s) => s.completedIds);
  const enqueue = useDownloadQueueStore((s) => s.enqueue);
  const resetMarkers = useDownloadQueueStore((s) => s.resetMarkers);

  // Track which model ids were enqueued through THIS hook so we can map
  // queue/current/completed back to per-slot state for the onboarding page.
  const [tracked, setTracked] = useState<ModelEntry[]>([]);

  const rows = useMemo<StateBySlot>(() => {
    const next: StateBySlot = {
      chat: { ...initialRows.chat },
      embed: { ...initialRows.embed },
      mmproj: { ...initialRows.mmproj },
    };
    for (const m of tracked) {
      const slot = m.slot;
      if (current?.id === m.id) {
        next[slot] = { status: "downloading", progress };
        continue;
      }
      if (queue.some((q) => q.id === m.id)) {
        next[slot] = { status: "pending", progress: 0 };
        continue;
      }
      if (errors[m.id]) {
        next[slot] = { status: "error", progress: 0 };
        continue;
      }
      if (completedIds.has(m.id)) {
        next[slot] = { status: "done", progress: 100 };
        continue;
      }
    }
    return next;
  }, [tracked, current, progress, queue, errors, completedIds]);

  const isDownloading = useMemo(
    () => Boolean(current) && tracked.some((m) => m.id === current?.id || queue.some((q) => q.id === m.id)),
    [current, tracked, queue],
  );

  const error = useMemo(() => {
    for (const m of tracked) {
      const msg = errors[m.id];
      if (msg) return msg;
    }
    return "";
  }, [tracked, errors]);

  const downloadQueue = useCallback(
    async (models: ModelEntry[]) => {
      setTracked((prev) => {
        const seen = new Set(prev.map((m) => m.id));
        const merged = [...prev];
        for (const m of models) if (!seen.has(m.id)) merged.push(m);
        return merged;
      });
      await enqueue(models);
    },
    [enqueue],
  );

  const cancel = useCallback(async (slot: ModelDownloadSlot) => {
    const { current: cur, queue: q } = useDownloadQueueStore.getState();
    if (cur?.slot === slot) {
      await useDownloadQueueStore.getState().cancel(cur.id);
      return;
    }
    const queued = q.find((m) => m.slot === slot);
    if (queued) await useDownloadQueueStore.getState().cancel(queued.id);
  }, []);

  const retry = useCallback(() => {
    setTracked([]);
    resetMarkers();
  }, [resetMarkers]);

  return { rows, isDownloading, error, downloadQueue, cancel, retry };
}
