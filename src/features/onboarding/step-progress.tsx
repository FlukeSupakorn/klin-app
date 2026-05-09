import { Fragment } from "react";
import { Check } from "lucide-react";
import type { OnboardingStep } from "@/types/onboarding";
import { STEPS } from "@/constants/onboarding";

interface StepProgressProps {
  currentStep: OnboardingStep;
}

export function StepProgress({ currentStep }: StepProgressProps) {
  const currentIndex = STEPS.findIndex((s) => s.id === currentStep);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "30px 40px 28px",
        position: "relative",
        flexShrink: 0,
        gap: 0,
      }}
    >
      {STEPS.map((step, index) => {
        const isCompleted = index < currentIndex;
        const isActive = index === currentIndex;
        return (
          <Fragment key={step.id}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 9, minWidth: 100, zIndex: 1 }}>
              <div
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: "50%",
                  background: isCompleted ? "#0F62FE" : "#fff",
                  border: `2px solid ${isCompleted ? "#0F62FE" : isActive ? "#0F62FE" : "#e4eafc"}`,
                  boxShadow: isActive ? "0 0 0 6px rgba(15,98,254,.10)" : "none",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 14,
                  fontWeight: 800,
                  color: isCompleted ? "#fff" : isActive ? "#0F62FE" : "#a8b4cc",
                  transition: "all .25s",
                }}
              >
                {isCompleted ? <Check className="h-4 w-4" strokeWidth={3} /> : index + 1}
              </div>
              <div style={{ textAlign: "center" }}>
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 800,
                    color: isCompleted || isActive ? "#0F62FE" : "#a8b4cc",
                    textTransform: "uppercase",
                    letterSpacing: ".1em",
                  }}
                >
                  {step.shortLabel}
                </div>
              </div>
            </div>
            {index < STEPS.length - 1 && (
              <div
                style={{
                  flex: 1,
                  height: 2,
                  background: "#e4eafc",
                  marginTop: -22,
                  marginInline: -6,
                  borderRadius: 2,
                  position: "relative",
                  overflow: "hidden",
                  maxWidth: 140,
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    background: "#0F62FE",
                    transform: `scaleX(${isCompleted ? 1 : 0})`,
                    transformOrigin: "left",
                    transition: "transform .35s",
                  }}
                />
              </div>
            )}
          </Fragment>
        );
      })}
    </div>
  );
}
