import { Check, X, CalendarPlus } from "lucide-react";
import type { DetectedCalendarEvent } from "@/types/calendar-events";
import { useCalendarNotificationsStore } from "@/stores/use-calendar-notifications-store";

interface NotificationCardProps {
  event: DetectedCalendarEvent;
  onOpen: () => void;
  disabled?: boolean;
}

function formatDatePill(startIso: string, allDay: boolean): string {
  if (!startIso) return "—";

  const datePart = startIso.includes("T") ? startIso.split("T")[0] : startIso;
  const timePart =
    !allDay && startIso.includes("T") ? startIso.split("T")[1]?.slice(0, 5) ?? "" : "";

  const date = new Date(`${datePart}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return startIso;
  }

  const dateLabel = date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });

  if (allDay || !timePart) {
    return dateLabel;
  }

  return `${dateLabel} · ${timePart}`;
}

export function NotificationCard({ event, onOpen, disabled = false }: NotificationCardProps) {
  const approve = useCalendarNotificationsStore((s) => s.approve);
  const reject = useCalendarNotificationsStore((s) => s.reject);
  const isPending = useCalendarNotificationsStore((s) =>
    s.pendingActionIds.has(event.id),
  );

  const datePill = formatDatePill(event.event.start_iso, event.event.all_day);

  return (
    <div
      className="relative flex items-center gap-3 overflow-hidden border-b border-border bg-card px-3.5 py-3 transition-colors last:border-b-0 hover:bg-muted/40"
    >
      <div
        className="absolute inset-y-0 left-0 w-[3px]"
        style={{ background: "var(--secondary)" }}
      />

      <button
        type="button"
        onClick={onOpen}
        disabled={isPending}
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
      >
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px]"
          style={{
            background: "color-mix(in oklab, var(--secondary) 18%, transparent)",
            border: "1px solid color-mix(in oklab, var(--secondary) 30%, transparent)",
          }}
        >
          <CalendarPlus className="h-4 w-4" style={{ color: "var(--secondary)" }} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <div className="truncate text-[12.5px] font-bold text-foreground">
              {event.event.title || "Untitled event"}
            </div>
            <span
              className="shrink-0 rounded-full px-2 py-[1px] text-[10px] font-bold"
              style={{ background: "var(--primary-tint)", color: "var(--primary)" }}
            >
              {datePill}
            </span>
          </div>
          <div className="mt-0.5 truncate text-[10.5px] text-muted-foreground">
            {event.fileName || "—"}
          </div>
        </div>
      </button>

      <div className="flex shrink-0 items-center gap-1.5">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            void approve(event.id);
          }}
          disabled={disabled || isPending}
          title="Add to Google Calendar"
          className="flex h-[26px] w-[26px] items-center justify-center rounded-[8px] transition-colors disabled:opacity-40"
          style={{
            background: "color-mix(in oklab, var(--success) 14%, transparent)",
            color: "var(--success)",
          }}
        >
          <Check className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            void reject(event.id);
          }}
          disabled={isPending}
          title="Dismiss"
          className="flex h-[26px] w-[26px] items-center justify-center rounded-[8px] transition-colors disabled:opacity-40"
          style={{
            background: "color-mix(in oklab, var(--destructive) 12%, transparent)",
            color: "var(--destructive)",
          }}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
