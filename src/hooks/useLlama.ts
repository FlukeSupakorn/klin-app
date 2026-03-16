import { tauriClient } from "@/services/tauri-client";
import type { ModelSlot } from "@/types/ipc";

/**
 * Ensures llama-server slot(s) are running before executing an AI call.
 * Use this for any fetch/request that depends on llama-server being alive.
 *
 * @example
 * const response = await withLlama(['chat'], () =>
 *   fetch("http://localhost:8080/v1/chat/completions", { method: "POST", body: ... })
 * );
 */
export async function withLlama<T>(
  slots: ModelSlot[],
  fn: () => Promise<T>,
): Promise<T> {
  await Promise.all(slots.map((s) => tauriClient.ensureLlamaServer(s)));
  try {
    return await fn();
  } finally {
    // Refresh the idle timer so the server is not killed mid-request.
    slots.forEach((s) => tauriClient.touchLlamaServer(s).catch(() => undefined));
  }
}

/**
 * Create a guard that refreshes the idle timer on each stream chunk read.
 * Call `onChunkRead()` inside your ReadableStream loop to prevent the
 * idle-timeout task from killing the server during long SSE streams.
 */
export function createLlamaStreamGuard(slot: ModelSlot): {
  onChunkRead: () => void;
} {
  return {
    onChunkRead: () => {
      tauriClient.touchLlamaServer(slot).catch(() => undefined);
    },
  };
}
