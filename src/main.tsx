import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { router } from "@/app/router";
import "@/styles/globals.css";

const isTauri = "__TAURI__" in window;
const hash = window.location.hash;
const pathname = window.location.pathname;

if (!isTauri && pathname !== "/oauth-callback" && hash.includes("access_token=")) {
  window.location.replace(`/oauth-callback${hash}`);
}

if (import.meta.env.DEV) {
  const originalFetch = window.fetch;
  window.fetch = async (...args) => {
    const startTime = performance.now();
    let method = "GET";
    let url = "";
    let requestBody: string | null = null;
    let status = 0;
    let responseBody: string | null = null;
    let errorMsg: string | null = null;

    if (typeof args[0] === "string" || args[0] instanceof URL) {
      url = args[0].toString();
      method = args[1]?.method || "GET";
      requestBody = typeof args[1]?.body === "string" ? args[1].body : null;
    } else if (args[0] instanceof Request) {
      url = args[0].url;
      method = args[0].method;
      // We can't easily read Request body without consuming it, so we leave it null or try to clone
      // For simplicity, we just won't capture Request object bodies unless passed in opts
      requestBody = typeof args[1]?.body === "string" ? args[1].body : null;
    }

    try {
      const response = await originalFetch(...args);
      status = response.status;

      // Clone response to read body
      try {
        const cloned = response.clone();
        const contentType = cloned.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          responseBody = await cloned.text();
        }
      } catch (e) {
        // Ignore clone errors
      }
      return response;
    } catch (error) {
      errorMsg = error instanceof Error ? error.message : String(error);
      throw error;
    } finally {
      const endTime = performance.now();
      try {
        const { useApiLogStore } = await import("@/stores/use-api-log-store");
        useApiLogStore.getState().addLog({
          timestamp: new Date().toISOString(),
          method,
          url,
          status,
          latencyMs: Math.round(endTime - startTime),
          requestBody,
          responseBody,
          error: errorMsg,
        });
      } catch {
        // Never let debug logging failures (e.g. localStorage quota) break API calls.
      }
    }
  };
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RouterProvider
      router={router}
      future={{
        v7_startTransition: true,
      }}
    />
  </React.StrictMode>,
);
