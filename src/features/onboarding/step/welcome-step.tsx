import { BrainCircuit, Cpu, Files, Folder, Sparkles } from "lucide-react";
import { Button } from "@/components/not-use-ui/button";

interface WelcomeStepProps {
  onNext: () => void;
}

const features = [
  {
    icon: BrainCircuit,
    label: "AI-Powered Sorting",
    desc: "Smart classification using context-aware models",
  },
  {
    icon: Folder,
    label: "Custom Categories",
    desc: "Define your own rules and folder hierarchies",
  },
  {
    icon: Files,
    label: "Live File Watching",
    desc: "Monitor directories in real-time, sort instantly",
  },
  {
    icon: Cpu,
    label: "Runs Locally",
    desc: "No cloud upload. Your files stay on your machine",
  },
];

export function WelcomeStep({ onNext }: WelcomeStepProps) {
  return (
    <div className="flex w-full max-w-2xl flex-col items-center gap-8 text-center">
      {/* Logo / brand mark */}
      <div className="relative">
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10 shadow-lg shadow-primary/10">
          <Sparkles className="h-9 w-9 text-primary" />
        </div>
        <div className="absolute -inset-2 -z-10 rounded-3xl bg-primary/5 blur-xl" />
      </div>

      {/* Heading */}
      <div className="space-y-3 max-w-sm">
        <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-primary">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
          Quick Setup — 3 minutes
        </div>
        <h1 className="font-syne text-4xl font-black uppercase tracking-tight text-foreground">
          Welcome To <span className="text-primary">KLIN</span>
        </h1>
        <p className="text-sm text-muted-foreground leading-relaxed text-pretty">
          Your intelligent file organization assistant. Let&apos;s configure
          your workspace so KLIN can start sorting, naming, and managing your
          files automatically.
        </p>
      </div>

      {/* Feature grid */}
      <div className="grid w-full max-w-xl grid-cols-1 gap-3 sm:grid-cols-2">
        {features.map(({ icon: Icon, label, desc }) => (
          <div
            key={label}
            className="group rounded-xl border border-border bg-muted/30 p-3.5 text-left transition-all duration-200 hover:border-primary/40"
          >
            <div className="mb-2.5 flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-background transition-all duration-200 group-hover:border-primary/30 group-hover:bg-primary/10">
              <Icon className="h-4 w-4 text-primary" />
            </div>
            <p className="text-xs font-semibold text-foreground mb-0.5">{label}</p>
            <p className="text-[11px] text-muted-foreground leading-relaxed">{desc}</p>
          </div>
        ))}
      </div>

      {/* CTA */}
      <div className="flex flex-col items-center gap-3 w-full max-w-xs">
        <Button onClick={onNext} className="h-11 w-full text-sm font-semibold">
          Get Started
        </Button>
        <p className="text-[11px] text-muted-foreground">
          No account required · Works offline
        </p>
      </div>
    </div>
  );
}
