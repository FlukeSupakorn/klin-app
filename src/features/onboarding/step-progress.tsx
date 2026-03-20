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
      <div className="absolute left-4 right-4 top-4 h-px bg-border" />
      {/* Progress line */}
      <div
        className="absolute left-4 top-4 h-px bg-primary transition-all duration-500"
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
                  "border-primary bg-primary text-primary-foreground",
                isActive &&
                  "border-primary bg-transparent text-primary",
                !isCompleted &&
                  !isActive &&
                  "border-border bg-transparent text-muted-foreground"
              )}
            >
              {isCompleted ? (
                <Check className="w-3.5 h-3.5" strokeWidth={3} />
              ) : (
                <span>{index + 1}</span>
              )}
              {isActive && (
                <span className="absolute inset-0 animate-ping rounded-full bg-primary opacity-20" />
              )}
            </div>
            <span
              className={cn(
                "text-center text-[10px] font-black uppercase tracking-widest transition-colors duration-300",
                isActive ? "text-primary" : "text-muted-foreground",
                isCompleted && "text-foreground"
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
