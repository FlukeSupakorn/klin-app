import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";

const SKIP_ONBOARDING = import.meta.env.VITE_SKIP_ONBOARDING === "true";

const HEALTH_URL_CANDIDATES = [
  "http://127.0.0.1:8000/health",
  "http://localhost:8000/health",
];

interface HealthResponse {
  onboarding_status: string;
}

// Module-level flag: set to true after the user completes onboarding in this
// session so the guard skips re-fetching /health on the redirect back to "/".
let sessionCompleted = false;

export function markOnboardingCompletedInSession() {
  sessionCompleted = true;
}

type CheckStatus = "loading" | "onboarding" | "ready";

export function OnboardingGuard() {
  const [status, setStatus] = useState<CheckStatus>(() => {
    if (SKIP_ONBOARDING || sessionCompleted) return "ready";
    return "loading";
  });

  useEffect(() => {
    if (SKIP_ONBOARDING || sessionCompleted) {
      setStatus("ready");
      return;
    }

    let cancelled = false;

    const check = async () => {
      for (const url of HEALTH_URL_CANDIDATES) {
        try {
          const res = await fetch(url);
          if (!res.ok) continue;
          const data: HealthResponse = await res.json();
          if (!cancelled) {
            setStatus(data.onboarding_status === "completed" ? "ready" : "onboarding");
          }
          return;
        } catch {
          // try next candidate
        }
      }
      // All candidates failed — show onboarding so user can set up
      if (!cancelled) setStatus("onboarding");
    };

    void check();
    return () => { cancelled = true; };
  }, []);

  if (status === "loading") {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (status === "onboarding") {
    return <Navigate to="/onboarding" replace />;
  }

  return <AppShell />;
}
