import { useEffect, useState, type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { AppSkeleton } from "@/components/layout/app-skeleton";
import { tauriClient } from "@/services/tauri-client";
import type { ModelConfigDto } from "@/types/ipc";

const SKIP_ONBOARDING = import.meta.env.VITE_SKIP_ONBOARDING === "true";
const WELCOME_SHOWN_KEY = "klin.welcome-shown";

function welcomeAlreadyShown(): boolean {
  try {
    return localStorage.getItem(WELCOME_SHOWN_KEY) === "true";
  } catch {
    return false;
  }
}

export function markWelcomeShownInSession() {
  try {
    localStorage.setItem(WELCOME_SHOWN_KEY, "true");
  } catch {
    // localStorage unavailable — non-fatal, guard will fall back to model check
  }
}

type CheckStatus = "loading" | "welcome" | "ready";

export function WelcomeGuard({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<CheckStatus>(() => {
    if (SKIP_ONBOARDING || welcomeAlreadyShown()) return "ready";
    return "loading";
  });

  useEffect(() => {
    if (SKIP_ONBOARDING || welcomeAlreadyShown()) {
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

      if (cancelled) return;

      if (hasChat && hasEmbed) {
        setStatus("ready");
      } else {
        setStatus("welcome");
      }
    };

    void check();
    return () => { cancelled = true; };
  }, []);

  if (status === "loading") {
    return <AppSkeleton />;
  }

  if (status === "welcome") {
    return <Navigate to="/welcome" replace />;
  }

  return <>{children}</>;
}
