import { useEffect, useState, type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { AppSkeleton } from "@/components/layout/app-skeleton";
import { logger } from "@/lib/logger";
import { tauriClient } from "@/services/tauri-client";
import type { ModelConfigDto } from "@/types/ipc";

const SKIP_ONBOARDING = import.meta.env.VITE_SKIP_ONBOARDING === "true";

type CheckStatus = "loading" | "model-download" | "ready";

export function ModelDownloadGuard({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<CheckStatus>(() => {
    if (SKIP_ONBOARDING) return "ready";
    return "loading";
  });

  useEffect(() => {
    if (SKIP_ONBOARDING) {
      logger.info("[model-download] skipped because VITE_SKIP_ONBOARDING=true");
      setStatus("ready");
      return;
    }

    let cancelled = false;

    const check = async () => {
      const [config, installed] = await Promise.all([
        tauriClient.readModelConfig().catch((): ModelConfigDto => ({ models: {} })),
        tauriClient.listInstalledModels().catch(() => []),
      ]);
      const installedNames = new Set(installed.map((model) => model.filename));
      const hasChat = Boolean(config.models.chat?.filename && installedNames.has(config.models.chat.filename));
      const hasEmbed = Boolean(config.models.embed?.filename && installedNames.has(config.models.embed.filename));
      logger.info("[model-download] guard check", {
        configuredChat: config.models.chat?.filename,
        configuredEmbed: config.models.embed?.filename,
        installedModels: installed.map((model) => model.filename),
        hasChat,
        hasEmbed,
      });

      if (!cancelled) {
        setStatus(hasChat && hasEmbed ? "ready" : "model-download");
      }
    };

    void check();
    return () => { cancelled = true; };
  }, []);

  if (status === "loading") {
    return <AppSkeleton />;
  }

  if (status === "model-download") {
    return <Navigate to="/model-download" replace />;
  }

  return <>{children}</>;
}
