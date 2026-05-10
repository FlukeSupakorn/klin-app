import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { AppShell } from "@/components/layout/app-shell";
import { KlinSetupScreen } from "@/components/layout/klin-setup-screen";

const SKIP_ONBOARDING = import.meta.env.VITE_SKIP_ONBOARDING === "true";
const ONBOARDING_COMPLETED_KEY = "klin.onboarding-completed";

const HEALTH_URL_CANDIDATES = [
  "http://127.0.0.1:8000/health",
  "http://localhost:8000/health",
];

const HEALTH_RETRY_ATTEMPTS = 10;
const HEALTH_RETRY_DELAY_MS = 500;

interface HealthResponse {
  onboarding_status: string;
}

// In-session fast-path: skip even the localStorage read once we've completed
// onboarding within this app run.
let sessionCompleted = false;

function onboardingAlreadyCompleted(): boolean {
  try {
    return localStorage.getItem(ONBOARDING_COMPLETED_KEY) === "true";
  } catch {
    return false;
  }
}

function persistOnboardingCompleted(): void {
  try {
    localStorage.setItem(ONBOARDING_COMPLETED_KEY, "true");
  } catch {
    // localStorage unavailable — non-fatal, guard will fall back to /health
  }
}

/**
 * Called by onboarding-page after the user finishes the setup flow.
 * Sets both the in-memory fast-path flag AND the persistent localStorage flag,
 * so subsequent launches (in this session OR after restart) skip /health.
 */
export function markOnboardingCompletedInSession(): void {
  sessionCompleted = true;
  persistOnboardingCompleted();
}

type CheckStatus = "loading" | "onboarding" | "ready";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function OnboardingGuard() {
  const [status, setStatus] = useState<CheckStatus>(() => {
    if (SKIP_ONBOARDING || sessionCompleted || onboardingAlreadyCompleted()) {
      return "ready";
    }
    return "loading";
  });

  useEffect(() => {
    if (SKIP_ONBOARDING || sessionCompleted || onboardingAlreadyCompleted()) {
      setStatus("ready");
      return;
    }

    let cancelled = false;

    const tryFetchOnce = async (): Promise<HealthResponse | "unreachable"> => {
      for (const url of HEALTH_URL_CANDIDATES) {
        try {
          const res = await fetch(url);
          if (!res.ok) continue;
          return (await res.json()) as HealthResponse;
        } catch {
          // try next candidate
        }
      }
      return "unreachable";
    };

    const check = async () => {
      // Retry-with-backoff: tolerate the worker sidecar being slow to bind
      // port 8000 on a cold prod launch. Stay on the splash while waiting —
      // never silently redirect the user back through onboarding because of
      // a transient ECONNREFUSED.
      for (let attempt = 0; attempt < HEALTH_RETRY_ATTEMPTS; attempt++) {
        if (cancelled) return;
        const result = await tryFetchOnce();
        if (cancelled) return;

        if (result !== "unreachable") {
          if (result.onboarding_status === "completed") {
            // Auto-heal: write the localStorage flag so future launches are
            // instant for users who upgraded from a build that lacked it.
            persistOnboardingCompleted();
            sessionCompleted = true;
            setStatus("ready");
          } else {
            setStatus("onboarding");
          }
          return;
        }

        // Worker not ready yet — wait and try again.
        await sleep(HEALTH_RETRY_DELAY_MS);
      }

      // Worker never came up within budget. Stay on the splash; do NOT
      // redirect to /onboarding (that would wipe a returning user back
      // through setup just because of a slow sidecar).
      // The KlinSetupScreen itself surfaces a "taking longer than usual" hint
      // after ~8s so the user knows it isn't frozen.
    };

    void check();
    return () => { cancelled = true; };
  }, []);

  if (status === "loading") {
    return <KlinSetupScreen step="Waiting for worker" />;
  }

  if (status === "onboarding") {
    return <Navigate to="/onboarding" replace />;
  }

  return <AppShell />;
}
