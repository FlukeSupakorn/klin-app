import { Button } from "@/components/ui/button";
import type { OnboardingState } from "../types";
import {
  Archive,
  BarChart2,
  CheckCircle2,
  Code2,
  Eye,
  FileText,
  Film,
  FolderOpen,
  Image,
  Loader2,
  Music,
  Palette,
  Rocket,
  Sparkles,
} from "lucide-react";

const ICON_MAP: Record<string, React.ElementType> = {
  FileText,
  Image,
  Film,
  Music,
  Code2,
  Archive,
  Palette,
  BarChart2,
};

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
        <div className="w-20 h-20 rounded-full bg-[--success-dim] border border-[--success]/30 flex items-center justify-center shadow-lg shadow-[--success]/10">
          <CheckCircle2 className="w-9 h-9 text-[--success]" />
        </div>
        <div className="absolute -inset-3 rounded-full bg-[--success]/5 blur-xl -z-10" />
      </div>

      {/* Text */}
      <div className="space-y-2">
        <h2 className="text-3xl font-bold text-foreground text-balance">
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
            className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[--surface-2] border border-[--border]"
          >
            <div className="w-8 h-8 rounded-lg bg-[--brand-dim] border border-[--brand]/20 flex items-center justify-center flex-shrink-0">
              <Icon className="w-4 h-4 text-[--brand]" />
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
            const Icon = ICON_MAP[cat.icon] ?? FileText;
            return (
              <div
                key={cat.id}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[--surface-2] border border-[--border] text-xs text-muted-foreground"
              >
                <Icon className="w-3 h-3 text-[--brand]" />
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
        className="w-full h-12 bg-[--brand] hover:bg-[--brand]/90 text-[--brand-foreground] font-bold text-base border-0 shadow-lg shadow-[--brand]/20"
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
