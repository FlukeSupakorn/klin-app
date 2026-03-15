import { tauriClient } from "@/services/tauri-client";

/**
 * Ensures llama-server is running before executing an AI call.
 * Use this for any fetch/request that depends on the llama-server being alive.
 *
 * @example
 * const response = await withLlama(() =>
 *   fetch("http://localhost:8080/v1/chat/completions", { method: "POST", body: ... })
 * );
 */
export async function withLlama<T>(fn: () => Promise<T>): Promise<T> {
  await tauriClient.ensureLlamaServer();
  try {
    return await fn();
  } finally {
    // Refresh the idle timer so the server is not killed mid-request.
    // This matters most for long SSE streams where no further
    // ensureLlamaServer calls would be made during the operation.
    tauriClient.touchLlamaServer().catch(() => undefined);
  }
}

/**
 * Create a guard that refreshes the idle timer on each stream chunk read.
 * Call `onChunkRead()` inside your ReadableStream loop to prevent the
 * idle-timeout task from killing the server during long SSE streams.
 */
export function createLlamaStreamGuard(): { onChunkRead: () => void } {
  return {
    onChunkRead: () => {
      tauriClient.touchLlamaServer().catch(() => undefined);
    },
  };
}
