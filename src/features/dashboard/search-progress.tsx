import { useEffect, useState } from "react";
import { Brain, Sparkles, FileSearch, Layers } from "lucide-react";

const STAGES = [
  { icon: FileSearch, label: "Scanning filenames" },
  { icon: Brain,      label: "Reading semantic index" },
  { icon: Layers,     label: "Ranking matches" },
  { icon: Sparkles,   label: "Polishing results" },
];

interface SearchProgressProps {
  startedAt: number | null;
}

export function SearchProgress({ startedAt }: SearchProgressProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 200);
    return () => window.clearInterval(id);
  }, []);

  const elapsedMs = startedAt ? Math.max(0, now - startedAt) : 0;
  const elapsedSec = elapsedMs / 1000;

  // Cycle through stages every ~1.4s; final stage sticks once we pass 4 cycles
  const stageIndex = Math.min(STAGES.length - 1, Math.floor(elapsedSec / 1.4));
  const stage = STAGES[stageIndex];
  const StageIcon = stage.icon;

  // Show "still working" reassurance after 4s
  const longRunning = elapsedSec >= 4;

  return (
    <div className="flex flex-col items-center gap-3 py-7">
      <div className="relative flex h-12 w-12 items-center justify-center">
        {/* Outer pulsing ring */}
        <span
          className="absolute inset-0 rounded-full"
          style={{
            background: "radial-gradient(circle, var(--primary) 0%, transparent 70%)",
            opacity: 0.18,
            animation: "klin-logo-breathe 1.6s ease-in-out infinite",
          }}
        />
        {/* Inner breathing icon */}
        <div
          className="relative flex h-9 w-9 items-center justify-center rounded-full"
          style={{
            background: "var(--primary)",
            animation: "klin-logo-breathe 1.6s ease-in-out infinite",
          }}
        >
          <StageIcon className="h-4 w-4 text-white" />
        </div>
      </div>

      <div className="flex flex-col items-center gap-1">
        <div className="text-[12.5px] font-semibold text-foreground">{stage.label}…</div>
        <div className="flex items-center gap-1.5">
          <ThinkingDots />
          <span
            className="text-[10.5px] tabular-nums text-muted-foreground"
            style={{ fontFamily: "'JetBrains Mono',monospace" }}
          >
            {elapsedSec.toFixed(1)}s
          </span>
        </div>
        {longRunning && (
          <div className="mt-0.5 text-[10.5px] text-muted-foreground">
            Semantic search can take a moment — you can keep working, results stay here.
          </div>
        )}
      </div>
    </div>
  );
}

function ThinkingDots() {
  return (
    <div className="flex items-center gap-1">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="block h-1.5 w-1.5 rounded-full"
          style={{
            background: "var(--primary)",
            animation: "klin-logo-breathe 1.2s ease-in-out infinite",
            animationDelay: `${i * 0.18}s`,
            opacity: 0.85,
          }}
        />
      ))}
    </div>
  );
}
