import * as Dialog from "@radix-ui/react-dialog";
import { ExternalLink, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { googleAuthService } from "@/features/auth/google-auth-service";
import { useAuthStore } from "@/features/auth/use-auth-store";
import { useCalendarStore } from "@/features/calendar/use-calendar-store";
import { tauriClient } from "@/services/tauri-client";

function formatEventTime(start: Date, end: Date, isAllDay: boolean): string {
  if (isAllDay) {
    return "All day";
  }

  return `${start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} - ${end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

export function CalendarEventModal() {
  const navigate = useNavigate();
  const selectedDate = useCalendarStore((state) => state.selectedDate);
  const isOpen = useCalendarStore((state) => state.isEventModalOpen);
  const isLoadingMonth = useCalendarStore((state) => state.isLoadingMonth);
  const close = useCalendarStore((state) => state.closeDateModal);
  const getEventsForDate = useCalendarStore((state) => state.getEventsForDate);

  const accessToken = useAuthStore((state) => state.accessToken);
  const expiresAt = useAuthStore((state) => state.expiresAt);

  const loggedIn = Boolean(accessToken) && !googleAuthService.isExpired(expiresAt);
  const events = selectedDate ? getEventsForDate(selectedDate) : [];

  const getGoogleCalendarDayUrl = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `https://calendar.google.com/calendar/u/0/r/day/${year}/${month}/${day}`;
  };

  const openEvent = async (link: string | undefined) => {
    if (!loggedIn) {
      close();
      navigate("/settings");
      return;
    }

    const fallbackDayUrl = selectedDate ? getGoogleCalendarDayUrl(selectedDate) : null;
    const targetUrl = link || fallbackDayUrl;

    if (!targetUrl) {
      return;
    }

    try {
      await tauriClient.openExternalUrl(targetUrl);
    } catch {
      window.open(targetUrl, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={(nextOpen) => (!nextOpen ? close() : undefined)}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[80] bg-foreground/30" />
        <Dialog.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-[90] w-[min(560px,92vw)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-card p-5 shadow-xl",
            "max-h-[70vh] overflow-y-auto",
          )}
        >
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <Dialog.Title className="text-lg font-semibold">Events</Dialog.Title>
              <Dialog.Description className="text-sm text-muted-foreground">
                {selectedDate ? selectedDate.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" }) : ""}
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon" aria-label="Close events">
                <X className="h-4 w-4" />
              </Button>
            </Dialog.Close>
          </div>

          {isLoadingMonth ? (
            <div className="rounded-lg border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
              Loading events...
            </div>
          ) : events.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
              No events
            </div>
          ) : (
            <div className="space-y-2">
              {events.map((event) => (
                <button
                  key={event.id}
                  type="button"
                  onClick={() => {
                    void openEvent(event.htmlLink);
                  }}
                  className="w-full rounded-xl border border-border/60 bg-background p-3 text-left transition-colors hover:bg-muted/40"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium">{event.title}</p>
                    <ExternalLink className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{formatEventTime(event.start, event.end, event.isAllDay)}</p>
                </button>
              ))}
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
