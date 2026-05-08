import { useEffect, useRef } from "react";
import { CheckCircle2, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface OrganizeResumeBubbleProps {
  show: boolean;
  isAnalyzing: boolean;
  processingCount: number;
  queuedCount: number;
  unresolvedCount: number;
  movedCount: number;
  onOpen: () => void;
  onDismiss: () => void;
  dismissLabel?: string;
}

export function OrganizeResumeBubble({
  show,
  isAnalyzing,
  processingCount,
  queuedCount,
  unresolvedCount,
  movedCount,
  onOpen,
  onDismiss,
  dismissLabel = "Dismiss",
}: OrganizeResumeBubbleProps) {
  const isCompleted = !isAnalyzing && unresolvedCount === 0 && movedCount > 0;
  const autoDismissRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isCompleted && show) {
      autoDismissRef.current = setTimeout(() => { onDismiss(); }, 4000);
    }
    return () => {
      if (autoDismissRef.current) clearTimeout(autoDismissRef.current);
    };
  }, [isCompleted, show, onDismiss]);

  if (!show) {
    return null;
  }

  const eyebrow = isCompleted ? "Organize Complete" : "Organize In Progress";
  const eyebrowColor = isCompleted ? "text-emerald-500" : "text-primary";
  const chipBg = isCompleted ? "var(--success)" : "var(--primary)";
  const ChipIcon = isCompleted ? CheckCircle2 : Loader2;
  const bodyText = isCompleted
    ? `${movedCount} file${movedCount !== 1 ? "s" : ""} organized`
    : isAnalyzing
      ? `${processingCount + queuedCount} file${processingCount + queuedCount !== 1 ? "s" : ""} still analyzing`
      : `${unresolvedCount} file${unresolvedCount !== 1 ? "s" : ""} still need action`;

  return (
    <div className="klin-toast-in fixed bottom-5 right-5 z-40 w-[320px] max-w-[90vw] overflow-hidden rounded-[16px] border border-border bg-card shadow-lg">
      <div className="h-0.5 w-full" style={{ background: "var(--primary)" }} />
      <div className="p-3.5">
        <div className="mb-2 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div
              className="flex h-6 w-6 items-center justify-center rounded-[7px]"
              style={{ background: chipBg }}
            >
              <ChipIcon className={`h-3 w-3 text-white ${!isCompleted ? "animate-spin" : ""}`} />
            </div>
            <p className={`text-[10px] font-extrabold uppercase tracking-widest ${eyebrowColor}`}>
              {eyebrow}
            </p>
          </div>
          <button
            type="button"
            className="flex h-6 w-6 items-center justify-center rounded-[7px] border border-border bg-muted text-muted-foreground hover:text-foreground"
            onClick={onDismiss}
            aria-label="Dismiss"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
        <div className="rounded-[9px] bg-muted/60 px-2.5 py-1.5">
          <p className="truncate text-[12px] font-bold text-foreground">{bodyText}</p>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <Button size="sm" className="h-8" onClick={onOpen}>
            {isCompleted ? "View organizer" : "Open organizer"}
          </Button>
          <Button size="sm" variant="ghost" className="h-8" onClick={onDismiss}>
            {dismissLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
