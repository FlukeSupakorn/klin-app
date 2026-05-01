import { useEffect, useRef } from "react";
import { CheckCircle2 } from "lucide-react";
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

  if (isCompleted) {
    return (
      <div className="fixed bottom-5 right-5 z-40 max-w-xs rounded-xl border border-border bg-card/95 p-3 shadow-lg backdrop-blur-xs">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0" style={{ color: "var(--success)" }} />
          <p className="text-sm font-semibold text-foreground">
            {movedCount} file{movedCount !== 1 ? "s" : ""} organized
          </p>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <Button size="sm" className="h-8" onClick={onOpen}>
            View organizer
          </Button>
          <Button size="sm" variant="ghost" className="h-8" onClick={onDismiss}>
            Dismiss
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-5 right-5 z-40 max-w-xs rounded-xl border border-border bg-card/95 p-3 shadow-lg backdrop-blur-xs">
      <p className="text-sm font-semibold text-foreground">Organize in progress</p>
      <p className="mt-1 text-xs text-muted-foreground">
        {isAnalyzing
          ? `${processingCount + queuedCount} file(s) still analyzing`
          : `${unresolvedCount} file(s) still need action`}
      </p>
      <div className="mt-3 flex items-center gap-2">
        <Button size="sm" className="h-8" onClick={onOpen}>
          Open organizer
        </Button>
        <Button size="sm" variant="ghost" className="h-8" onClick={onDismiss}>
          {dismissLabel}
        </Button>
      </div>
    </div>
  );
}
