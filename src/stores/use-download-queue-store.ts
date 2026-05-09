import { create } from "zustand";
import { listen } from "@tauri-apps/api/event";
import { tauriClient } from "@/services/tauri-client";
import { logger } from "@/lib/logger";
import type { ModelEntry } from "@/features/model-download/available-models";
import type { ModelDownloadProgressPayload } from "@/types/ipc";

export type QueuedRowStatus = "idle" | "queued" | "downloading" | "verified" | "done" | "error";

export interface PerSlotState {
  status: QueuedRowStatus;
  progress: number;
}

interface DownloadQueueState {
  /** Models waiting to be downloaded (FIFO). */
  queue: ModelEntry[];
  /** The model currently being downloaded, if any. */
  current: ModelEntry | null;
  /** Live progress 0-100 for the current model. */
  progress: number;
  /** Last error message keyed by model.id. Cleared on next enqueue of the same id. */
  errors: Record<string, string>;
  /** Model ids successfully completed in this app session. */
  completedIds: Set<string>;

  /**
   * Add models to the back of the queue. Returns a Promise that resolves when
   * ALL of the supplied models finish, and rejects on the first error.
   * Calls within the same tick are appended in argument order.
   */
  enqueue: (models: ModelEntry[]) => Promise<void>;

  /** Cancel a queued model (removes from queue) or the active download. */
  cancel: (modelId: string) => Promise<void>;

  /** Clear errors + completed flags (does not touch queue/current). */
  resetMarkers: () => void;
}

// ── Module-scoped coordination state ──────────────────────────────────────
// Promise resolvers per pending model id. Stored outside the zustand state
// because the resolver functions aren't serializable / subscribable.
const pendingResolvers = new Map<
  string,
  Array<{ resolve: () => void; reject: (err: Error) => void }>
>();
let isWorkerRunning = false;
let listenerAttached = false;

async function attachProgressListener(): Promise<void> {
  if (listenerAttached) return;
  listenerAttached = true;
  try {
    await listen<ModelDownloadProgressPayload>("model-download://progress", (event) => {
      const { slot, downloaded, total } = event.payload;
      const current = useDownloadQueueStore.getState().current;
      if (!current || current.slot !== slot) return;
      const progress = total > 0 ? Math.min(100, Math.round((downloaded / total) * 100)) : 0;
      useDownloadQueueStore.setState({ progress });
    });
  } catch (err) {
    listenerAttached = false;
    logger.error("[download-queue] failed to attach progress listener", err);
  }
}

async function processOne(model: ModelEntry): Promise<void> {
  const modelDir = await tauriClient.getModelDir();
  const dest = `${modelDir}\\${model.filename}`;
  logger.info(`[download-queue] start ${model.slot}:${model.filename} from ${model.url} to ${dest}`);

  let expectedSha256 = model.sha256;
  let expectedSize = model.sizeBytes;
  if (model.url.startsWith("https://huggingface.co/")) {
    try {
      const meta = await tauriClient.resolveHfModelMetadata(model.url);
      expectedSha256 = meta.sha256;
      expectedSize = meta.size;
      logger.info(
        `[download-queue] resolved HF metadata for ${model.slot}: sha256=${expectedSha256} size=${expectedSize}`,
      );
    } catch (metaError) {
      logger.warn("[download-queue] HF metadata lookup failed; using bundled sha256", metaError);
    }
  }

  await tauriClient.downloadModel({
    url: model.url,
    destFilename: model.filename,
    slot: model.slot,
    expectedSha256,
    expectedSize,
  });

  await tauriClient.writeModelConfig(model.slot, model.filename, expectedSha256);
}

async function drainQueue(): Promise<void> {
  if (isWorkerRunning) return;
  if (useDownloadQueueStore.getState().queue.length === 0) return;
  isWorkerRunning = true;
  await attachProgressListener();

  try {
    while (useDownloadQueueStore.getState().queue.length > 0) {
      const model = useDownloadQueueStore.getState().queue[0];
      useDownloadQueueStore.setState((s) => ({
        queue: s.queue.slice(1),
        current: model,
        progress: 0,
      }));

      const handlers = pendingResolvers.get(model.id) ?? [];

      try {
        await processOne(model);
        useDownloadQueueStore.setState((s) => {
          const completedIds = new Set(s.completedIds);
          completedIds.add(model.id);
          const errors = { ...s.errors };
          delete errors[model.id];
          return { current: null, progress: 0, completedIds, errors };
        });
        for (const h of handlers) h.resolve();
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error(`[download-queue] download failed for ${model.id}`, err);
        useDownloadQueueStore.setState((s) => ({
          current: null,
          progress: 0,
          errors: { ...s.errors, [model.id]: message },
        }));
        const error = err instanceof Error ? err : new Error(message);
        for (const h of handlers) h.reject(error);
      } finally {
        pendingResolvers.delete(model.id);
      }
    }
  } finally {
    isWorkerRunning = false;
  }
}

export const useDownloadQueueStore = create<DownloadQueueState>((set, _get) => ({
  queue: [],
  current: null,
  progress: 0,
  errors: {},
  completedIds: new Set<string>(),

  enqueue: (models) => {
    if (models.length === 0) return Promise.resolve();
    const promises: Array<Promise<void>> = [];
    for (const model of models) {
      const p = new Promise<void>((resolve, reject) => {
        const arr = pendingResolvers.get(model.id) ?? [];
        arr.push({ resolve, reject });
        pendingResolvers.set(model.id, arr);
      });
      promises.push(p);
    }
    set((s) => {
      const errors = { ...s.errors };
      for (const m of models) delete errors[m.id];
      return { queue: [...s.queue, ...models], errors };
    });
    void drainQueue();
    return Promise.all(promises).then(() => undefined);
  },

  cancel: async (modelId) => {
    const { queue, current } = useDownloadQueueStore.getState();
    if (current?.id === modelId) {
      try {
        await tauriClient.cancelModelDownload(current.slot);
      } catch (err) {
        logger.error("[download-queue] cancelModelDownload failed", err);
      }
      // The active download will reject with "cancelled" via the catch in drainQueue.
      return;
    }
    const idx = queue.findIndex((m) => m.id === modelId);
    if (idx >= 0) {
      const removed = queue[idx];
      set({ queue: queue.filter((_, i) => i !== idx) });
      const handlers = pendingResolvers.get(removed.id) ?? [];
      pendingResolvers.delete(removed.id);
      for (const h of handlers) h.reject(new Error("cancelled"));
    }
  },

  resetMarkers: () => set({ errors: {}, completedIds: new Set() }),
}));

// ── Selectors / helpers ───────────────────────────────────────────────────

/** 1-indexed position in the queue (1 = next up after current). 0 if not queued. */
export function getQueuePosition(modelId: string): number {
  const { queue } = useDownloadQueueStore.getState();
  const idx = queue.findIndex((m) => m.id === modelId);
  return idx < 0 ? 0 : idx + 1;
}

/**
 * Per-slot view of the queue for legacy callers (the onboarding model-download
 * page) that show a single row per slot.
 */
export function deriveSlotState(slot: ModelEntry["slot"]): PerSlotState {
  const { current, progress, queue, completedIds, errors } = useDownloadQueueStore.getState();
  if (current && current.slot === slot) {
    return { status: "downloading", progress };
  }
  if (queue.some((m) => m.slot === slot)) {
    return { status: "queued", progress: 0 };
  }
  // Find the most recent completed/error model for this slot.
  const erroredId = Object.keys(errors).find((id) => {
    // We don't have model objects in errors; this branch only fires if caller
    // knows their slot. Skip by default; "done" win is preferred.
    return id && false;
  });
  if (erroredId) return { status: "error", progress: 0 };
  // We can't reliably detect "done by slot" without storing slot per completed
  // entry. Onboarding compares against its own queue, so this is safe to leave
  // as "idle" — the caller derives "done" from completedIds itself.
  if (completedIds.size > 0) return { status: "idle", progress: 0 };
  return { status: "idle", progress: 0 };
}
