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
  return fn();
}
