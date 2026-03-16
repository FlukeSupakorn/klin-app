import { BrainCircuit, Cpu, Files, Folder, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

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
    <div className="flex flex-col items-center text-center gap-8">
      {/* Logo / brand mark */}
      <div className="relative">
        <div className="w-20 h-20 rounded-2xl bg-[--brand-dim] border border-[--brand]/30 flex items-center justify-center shadow-lg shadow-[--brand]/10">
          <Sparkles className="w-9 h-9 text-[--brand]" />
        </div>
        <div className="absolute -inset-2 rounded-3xl bg-[--brand]/5 blur-xl -z-10" />
      </div>

      {/* Heading */}
      <div className="space-y-3 max-w-sm">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[--brand-dim] border border-[--brand]/20 text-[--brand] text-xs font-mono uppercase tracking-widest">
          <span className="w-1.5 h-1.5 rounded-full bg-[--brand] animate-pulse" />
          Quick Setup — 3 minutes
        </div>
        <h1 className="text-3xl font-bold text-balance text-foreground leading-tight">
          Welcome to <span className="text-[--brand]">KLIN</span>
        </h1>
        <p className="text-sm text-muted-foreground leading-relaxed text-pretty">
          Your intelligent file organization assistant. Let&apos;s configure
          your workspace so KLIN can start sorting, naming, and managing your
          files automatically.
        </p>
      </div>

      {/* Feature grid */}
      <div className="w-full max-w-sm grid grid-cols-2 gap-3">
        {features.map(({ icon: Icon, label, desc }) => (
          <div
            key={label}
            className="group p-3.5 rounded-xl bg-[--surface-2] border border-[--border] hover:border-[--brand]/40 hover:bg-[--brand-dim] transition-all duration-200 text-left"
          >
            <div className="w-8 h-8 rounded-lg bg-[--surface-3] border border-[--border] flex items-center justify-center mb-2.5 group-hover:border-[--brand]/30 group-hover:bg-[--brand]/10 transition-all duration-200">
              <Icon className="w-4 h-4 text-[--brand]" />
            </div>
            <p className="text-xs font-semibold text-foreground mb-0.5">{label}</p>
            <p className="text-[11px] text-muted-foreground leading-relaxed">{desc}</p>
          </div>
        ))}
      </div>

      {/* CTA */}
      <div className="flex flex-col items-center gap-3 w-full max-w-xs">
        <Button
          onClick={onNext}
          className="w-full h-11 font-semibold text-sm border-0"
        >
          Get Started
        </Button>
        <p className="text-[11px] text-muted-foreground">
          No account required · Works offline
        </p>
      </div>
    </div>
  );
}
