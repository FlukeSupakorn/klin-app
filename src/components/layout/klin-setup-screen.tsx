import { useEffect, useState } from "react";
import klinLogo from "@/assets/klin-logo.svg";
import { Spinner } from "@/components/ui/spinner";

interface KlinSetupScreenProps {
  step: string;
}

const SLOW_THRESHOLD_MS = 8000;

export function KlinSetupScreen({ step }: KlinSetupScreenProps) {
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setSlow(true), SLOW_THRESHOLD_MS);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <div
      className="klin-fade-in fixed inset-0 z-50 flex flex-col items-center justify-center"
      style={{ background: "var(--background)" }}
    >
      <img
        src={klinLogo}
        alt="Klin"
        className="klin-logo-breathe mb-8 h-16 w-16 select-none"
        draggable={false}
      />
      <div
        className="text-[22px] font-bold tracking-tight"
        style={{ color: "var(--foreground)" }}
      >
        Klin is setting things up…
      </div>
      <div className="mt-3 flex items-center gap-2 text-[13px] text-muted-foreground">
        <Spinner className="h-3.5 w-3.5" style={{ color: "var(--primary)" }} />
        <span>{step || "Just a moment"}</span>
      </div>
      {slow ? (
        <div className="mt-2 text-[12px] text-muted-foreground/70">
          This is taking longer than usual…
        </div>
      ) : null}
    </div>
  );
}
