import { useState } from "react";
import { Minimize2, X } from "lucide-react";

interface CloseAppModalProps {
  open: boolean;
  onMinimize: () => void;
  onQuit: () => void;
  onCancel: () => void;
}

export function CloseAppModal({ open, onMinimize, onQuit, onCancel }: CloseAppModalProps) {
  const [isLoading, setIsLoading] = useState(false);

  if (!open) return null;

  const handleQuit = () => {
    setIsLoading(true);
    onQuit();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" onClick={onCancel} />
      <div
        className="relative w-[360px] overflow-hidden rounded-[20px] border border-border bg-card p-6"
        style={{ boxShadow: "0 20px 60px rgba(0,0,0,0.18)" }}
      >
        {/* Header */}
        <div className="mb-1 text-[15px] font-extrabold text-foreground">Close KLIN</div>
        <div className="text-[12.5px] text-muted-foreground">
          Would you like to minimize to tray or quit the application?
        </div>

        {/* Options */}
        <div className="mt-5 flex flex-col gap-2.5">
          <button
            onClick={onMinimize}
            disabled={isLoading}
            className="flex items-center gap-3 rounded-[14px] border border-border bg-muted/50 px-4 py-3.5 text-left transition-colors hover:bg-muted"
          >
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px]"
              style={{ background: "var(--primary-soft)", border: "1px solid var(--primary-border)" }}
            >
              <Minimize2 className="h-4 w-4 text-primary" />
            </div>
            <div>
              <div className="text-[13px] font-bold text-foreground">Minimize to Tray</div>
              <div className="text-[11px] text-muted-foreground">Keep running in the background</div>
            </div>
          </button>

          <button
            onClick={handleQuit}
            disabled={isLoading}
            className="flex items-center gap-3 rounded-[14px] border px-4 py-3.5 text-left transition-colors hover:opacity-90"
            style={{ background: "#fef2f2", borderColor: "#fecaca" }}
          >
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px]"
              style={{ background: "#fee2e2", border: "1px solid #fca5a5" }}
            >
              <X className="h-4 w-4" style={{ color: "var(--destructive)" }} />
            </div>
            <div>
              <div className="text-[13px] font-bold" style={{ color: "var(--destructive)" }}>
                {isLoading ? "Quitting…" : "Quit Application"}
              </div>
              <div className="text-[11px]" style={{ color: "var(--destructive)", opacity: 0.7 }}>
                Close KLIN completely
              </div>
            </div>
          </button>
        </div>

        {/* Cancel */}
        <button
          onClick={onCancel}
          disabled={isLoading}
          className="mt-3 w-full rounded-[12px] py-2.5 text-[13px] font-bold text-muted-foreground transition-colors hover:bg-muted"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
