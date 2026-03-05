import { createPortal } from "react-dom";
import { Upload } from "lucide-react";
import { cn } from "@/lib/utils";

interface FileDropOverlayProps {
  visible: boolean;
}

export function FileDropOverlay({ visible }: FileDropOverlayProps) {
  return createPortal(
    <div
      className={cn(
        "pointer-events-none fixed inset-0 z-[9999] transition-opacity duration-150",
        visible ? "opacity-100" : "opacity-0",
      )}
    >
      {/* Dim background */}
      <div className="absolute inset-0 bg-background/60 backdrop-blur-[2px]" />

      {/* Glowing border frame */}
      <div className="absolute inset-3 rounded-2xl border-2 border-primary shadow-[0_0_0_4px_hsl(var(--primary)/0.15),inset_0_0_60px_hsl(var(--primary)/0.06)]" />

      {/* Drop hint */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl border-2 border-primary bg-primary/10 shadow-[0_0_24px_hsl(var(--primary)/0.3)]">
          <Upload className="h-9 w-9 text-primary" />
        </div>
        <p className="text-xl font-black text-foreground">Drop to Organize</p>
        <p className="text-sm text-muted-foreground">Release to send files to the organizer</p>
      </div>
    </div>,
    document.body,
  );
}
