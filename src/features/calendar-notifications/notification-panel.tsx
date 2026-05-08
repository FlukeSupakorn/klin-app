import { CalendarPlus, RefreshCcw } from "lucide-react";
import { useEffect, useRef } from "react";
import { useCalendarNotificationsStore } from "@/stores/use-calendar-notifications-store";
import { useAuthStore } from "@/hooks/auth/use-auth-store";
import { NotificationCard } from "./notification-card";

interface NotificationPanelProps {
  open: boolean;
  onClose: () => void;
}

export function NotificationPanel({ open, onClose }: NotificationPanelProps) {
  const events = useCalendarNotificationsStore((s) => s.events);
  const isLoading = useCalendarNotificationsStore((s) => s.isLoading);
  const refresh = useCalendarNotificationsStore((s) => s.refresh);
  const openModal = useCalendarNotificationsStore((s) => s.openModal);

  const authStatus = useAuthStore((s) => s.status);
  const login = useAuthStore((s) => s.login);
  const isAuthed = authStatus === "authenticated";

  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <div
      ref={panelRef}
      className="klin-slide-up absolute right-0 top-[calc(100%+8px)] z-90 w-[360px] overflow-hidden rounded-[16px] border border-border bg-card"
      style={{ boxShadow: "0 12px 40px var(--primary-border)" }}
    >
      <div
        className="flex items-center gap-2 border-b border-border px-3.5 py-2.5"
        style={{ background: "var(--muted)" }}
      >
        <CalendarPlus className="h-3.5 w-3.5" style={{ color: "var(--secondary-foreground)" }} />
        <span className="text-[10.5px] font-extrabold uppercase tracking-widest" style={{ color: "var(--secondary-foreground)" }}>
          Calendar events detected
        </span>
        <span className="ml-auto text-[10.5px] text-muted-foreground">
          {events.length} {events.length === 1 ? "event" : "events"}
        </span>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={isLoading}
          title="Refresh"
          className="ml-1 flex h-5 w-5 items-center justify-center rounded-[6px] hover:bg-border/60 disabled:opacity-40"
        >
          <RefreshCcw
            className="h-3 w-3 text-muted-foreground"
            style={{ animation: isLoading ? "spin 1s linear infinite" : undefined }}
          />
        </button>
      </div>

      <div className="max-h-[400px] overflow-y-auto">
        {!isAuthed ? (
          <div className="flex flex-col items-center justify-center gap-3 p-6 text-center">
            <div className="text-[12.5px] font-bold text-foreground">
              Connect Google to see calendar suggestions
            </div>
            <div className="text-[11px] text-muted-foreground">
              Detected events will appear here once you sign in.
            </div>
            <button
              type="button"
              onClick={() => void login()}
              className="rounded-[10px] px-3 py-1.5 text-[12px] font-bold text-white transition-colors"
              style={{ background: "var(--primary)" }}
            >
              Sign in with Google
            </button>
          </div>
        ) : isLoading && events.length === 0 ? (
          <div className="py-6 text-center text-[13px] text-muted-foreground">Loading…</div>
        ) : events.length === 0 ? (
          <div className="py-6 text-center text-[12.5px] text-muted-foreground">
            No new events from your files yet
          </div>
        ) : (
          events.map((event) => (
            <NotificationCard
              key={event.id}
              event={event}
              onOpen={() => openModal(event.id)}
              disabled={!isAuthed}
            />
          ))
        )}
      </div>
    </div>
  );
}
