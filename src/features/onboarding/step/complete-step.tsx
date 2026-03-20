import { Button } from "@/components/not-use-ui/button";
import type { OnboardingState } from "../types";
import { getCategoryIcon } from "@/features/categories/category-appearance";
import {
  CheckCircle2,
  Eye,
  FolderOpen,
  Loader2,
  Rocket,
  Sparkles,
} from "lucide-react";

interface CompleteStepProps {
  state: OnboardingState;
  onLaunch: () => void;
  isLaunching?: boolean;
}

export function CompleteStep({ state, onLaunch, isLaunching = false }: CompleteStepProps) {
  const summaryItems = [
    {
      icon: FolderOpen,
      label: "Base Path",
      value: state.basePath || "~/KLIN",
    },
    {
      icon: Sparkles,
      label: "Categories",
      value: `${state.categories.length} active categories`,
    },
    {
      icon: Eye,
      label: "Watcher Folders",
      value:
        state.watcherFolders.length > 0
          ? `${state.watcherFolders.length} director${state.watcherFolders.length === 1 ? "y" : "ies"} monitored`
          : "No watchers (can add later)",
    },
  ];

  return (
    <div className="flex flex-col items-center gap-8 w-full max-w-md text-center">
      {/* Success icon */}
      <div className="relative">
        <div className="flex h-20 w-20 items-center justify-center rounded-full border border-primary/30 bg-primary/10 shadow-lg shadow-primary/10">
          <CheckCircle2 className="h-9 w-9 text-primary" />
        </div>
        <div className="absolute -inset-3 -z-10 rounded-full bg-primary/5 blur-xl" />
      </div>

      {/* Text */}
      <div className="space-y-2">
        <h2 className="font-syne text-3xl font-black uppercase tracking-tight text-foreground text-balance">
          You&apos;re all set!
        </h2>
        <p className="text-sm text-muted-foreground leading-relaxed text-pretty">
          KLIN is configured and ready to start organizing your files
          intelligently. Here&apos;s a summary of your setup.
        </p>
      </div>

      {/* Summary card */}
      <div className="w-full space-y-2 text-left">
        {summaryItems.map(({ icon: Icon, label, value }) => (
          <div
            key={label}
            className="flex items-center gap-3 rounded-xl border border-border bg-muted/30 px-4 py-3"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10">
              <Icon className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
                {label}
              </p>
              <p className="text-sm font-medium text-foreground">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Category chips */}
      <div className="w-full text-left space-y-2">
        <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
          Active categories
        </p>
        <div className="flex flex-wrap gap-1.5">
          {state.categories.map((cat) => {
            const Icon = getCategoryIcon(cat.icon);
            return (
              <div
                key={cat.id}
                className="flex items-center gap-1.5 rounded-full border border-border bg-muted/30 px-2.5 py-1 text-xs text-muted-foreground"
              >
                <Icon className="h-3 w-3 text-primary" />
                {cat.name}
              </div>
            );
          })}
        </div>
      </div>

      {/* Launch */}
      <Button
        onClick={onLaunch}
        disabled={isLaunching}
        className="h-12 w-full text-base font-bold"
      >
        {isLaunching ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Setting up…
          </>
        ) : (
          <>
            <Rocket className="w-4 h-4 mr-2" />
            Launch KLIN
          </>
        )}
      </Button>

      <p className="text-[11px] text-muted-foreground">
        You can update any of these settings later from the Settings panel.
      </p>
    </div>
  );
}
