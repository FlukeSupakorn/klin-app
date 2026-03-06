import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { router } from "@/app/router";
import "@/styles/theme-variables.css";
import "@/styles/globals.css";

const isTauri = "__TAURI__" in window;
const hash = window.location.hash;
const pathname = window.location.pathname;

if (!isTauri && pathname !== "/oauth-callback" && hash.includes("access_token=")) {
  window.location.replace(`/oauth-callback${hash}`);
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
