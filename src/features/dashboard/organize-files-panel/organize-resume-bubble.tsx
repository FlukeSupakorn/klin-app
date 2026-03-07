import { Button } from "@/components/ui/button";

interface OrganizeResumeBubbleProps {
  show: boolean;
  isAnalyzing: boolean;
  processingCount: number;
  queuedCount: number;
  unresolvedCount: number;
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
  onOpen,
  onDismiss,
  dismissLabel = "Dismiss",
}: OrganizeResumeBubbleProps) {
  if (!show) {
    return null;
  }

  return (
    <div className="fixed bottom-5 right-5 z-40 max-w-xs rounded-xl border border-border bg-card/95 p-3 shadow-lg backdrop-blur-sm">
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
