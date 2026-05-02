import { tauriClient } from "@/services/tauri-client";
import type { FrontendLogLevel } from "@/types/ipc";

const isTauri = typeof window !== "undefined" && "__TAURI__" in window;

function serializeContext(ctx: unknown): string | undefined {
  if (ctx === undefined || ctx === null) return undefined;
  if (ctx instanceof Error)
    return JSON.stringify({ message: ctx.message, stack: ctx.stack });
  if (typeof ctx === "string") return ctx;
  try {
    return JSON.stringify(ctx);
  } catch {
    return String(ctx);
  }
}

function send(level: FrontendLogLevel, message: string, context?: unknown): void {
  const ctx = serializeContext(context);
  const fn =
    level === "debug" ? "debug" :
    level === "warn"  ? "warn"  :
    level === "error" ? "error" : "info";
  ctx !== undefined ? console[fn](message, ctx) : console[fn](message);
  if (!isTauri) return;
  tauriClient.logFrontend({ level, message, context: ctx }).catch(() => {});
}

export const logger = {
  debug: (message: string, context?: unknown) => send("debug", message, context),
  info:  (message: string, context?: unknown) => send("info",  message, context),
  warn:  (message: string, context?: unknown) => send("warn",  message, context),
  error: (message: string, context?: unknown) => send("error", message, context),
};
