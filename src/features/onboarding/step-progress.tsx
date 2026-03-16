import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
import type { OnboardingStep } from "./types";
import { STEPS } from "./types";

interface StepProgressProps {
  currentStep: OnboardingStep;
}

export function StepProgress({ currentStep }: StepProgressProps) {
  const currentIndex = STEPS.findIndex((s) => s.id === currentStep);
  const progressPercent =
    currentIndex === 0
      ? 0
      : (currentIndex / (STEPS.length - 1)) * 100;

  return (
    <div className="relative flex items-start w-full">
      {/* Background line */}
      <div className="absolute top-4 left-4 right-4 h-px bg-[--border]" />
      {/* Progress line */}
      <div
        className="absolute top-4 left-4 h-px bg-[--brand] transition-all duration-500"
        style={{ width: `calc((100% - 2rem) * ${progressPercent / 100})` }}
      />

      {STEPS.map((step, index) => {
        const isCompleted = index < currentIndex;
        const isActive = index === currentIndex;

        return (
          <div key={step.id} className="flex-1 flex flex-col items-center gap-1.5 relative z-10">
            <div
              className={cn(
                "relative flex items-center justify-center w-8 h-8 rounded-full border-2 text-xs font-mono font-semibold transition-all duration-300",
                isCompleted &&
                  "bg-[--brand] border-[--brand] text-[--brand-foreground]",
                isActive &&
                  "bg-transparent border-[--brand] text-[--brand]",
                !isCompleted &&
                  !isActive &&
                  "bg-transparent border-[--border] text-[--muted-foreground]"
              )}
            >
              {isCompleted ? (
                <Check className="w-3.5 h-3.5" strokeWidth={3} />
              ) : (
                <span>{index + 1}</span>
              )}
              {isActive && (
                <span className="absolute inset-0 rounded-full animate-ping bg-[--brand] opacity-20" />
              )}
            </div>
            <span
              className={cn(
                "text-[10px] font-mono uppercase tracking-widest transition-colors duration-300 text-center",
                isActive ? "text-[--brand]" : "text-[--muted-foreground]",
                isCompleted && "text-[--foreground]"
              )}
            >
              {step.shortLabel}
            </span>
          </div>
        );
      })}
    </div>
  );
}
