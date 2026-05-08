import { CalendarCheck, ExternalLink, X, AlertCircle } from "lucide-react";
import { tauriClient } from "@/services/tauri-client";
import { logger } from "@/lib/logger";

const GOOGLE_CALENDAR_FALLBACK_URL = "https://calendar.google.com/calendar/u/0/r";

interface EventAddedToastProps {
  title: string;
  htmlLink: string | null | undefined;
  onDismiss: () => void;
}

export function EventAddedToast({ title, htmlLink, onDismiss }: EventAddedToastProps) {
  const openInGoogleCalendar = async () => {
    const target = htmlLink && htmlLink.length > 0 ? htmlLink : GOOGLE_CALENDAR_FALLBACK_URL;
    try {
      await tauriClient.openExternalUrl(target);
    } catch (error) {
      logger.warn("[event-added-toast] tauri open failed, falling back to window.open", error);
      window.open(target, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <div className="klin-toast-in pointer-events-auto w-[320px] max-w-[90vw] overflow-hidden rounded-[16px] border border-border bg-card shadow-lg">
      <div className="h-0.5 w-full" style={{ background: "var(--primary)" }} />
      <div className="p-3.5">
        <div className="mb-2 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div
              className="flex h-6 w-6 items-center justify-center rounded-[7px]"
              style={{ background: "var(--success)" }}
            >
              <CalendarCheck className="h-3 w-3 text-white" />
            </div>
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-500">
              Event Added
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
          <p className="truncate text-[12px] font-bold text-foreground" title={title}>{title}</p>
          <p className="truncate text-[10.5px] text-muted-foreground">Added to Google Calendar</p>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={() => { void openInGoogleCalendar(); }}
            className="inline-flex h-8 items-center gap-1.5 rounded-[9px] px-3 text-[12px] font-bold text-white transition-opacity hover:opacity-90"
            style={{ background: "var(--primary)" }}
          >
            <ExternalLink className="h-3 w-3" />
            Open in Google Calendar
          </button>
          <button
            type="button"
            onClick={onDismiss}
            className="inline-flex h-8 items-center rounded-[9px] px-3 text-[12px] font-semibold text-muted-foreground hover:text-foreground"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}

interface CalendarErrorToastProps {
  eyebrow: string;
  message: string;
  onDismiss: () => void;
}

export function CalendarErrorToast({ eyebrow, message, onDismiss }: CalendarErrorToastProps) {
  return (
    <div className="klin-toast-in pointer-events-auto w-[320px] max-w-[90vw] overflow-hidden rounded-[16px] border border-border bg-card shadow-lg">
      <div className="h-0.5 w-full" style={{ background: "var(--destructive)" }} />
      <div className="p-3.5">
        <div className="mb-2 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div
              className="flex h-6 w-6 items-center justify-center rounded-[7px]"
              style={{ background: "var(--destructive)" }}
            >
              <AlertCircle className="h-3 w-3 text-white" />
            </div>
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-destructive">
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
          <p className="text-[12px] font-bold text-foreground">{message}</p>
        </div>
      </div>
    </div>
  );
}
