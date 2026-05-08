import * as Dialog from "@radix-ui/react-dialog";
import { ExternalLink } from "lucide-react";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { tauriClient } from "@/services/tauri-client";
import { normalizeOsPath } from "@/lib/path-utils";
import { useAuthStore } from "@/hooks/auth/use-auth-store";
import { useCalendarNotificationsStore } from "@/stores/use-calendar-notifications-store";

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[110px_1fr] gap-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="wrap-break-word text-foreground">{value || "-"}</span>
    </div>
  );
}

function formatStart(startIso: string, allDay: boolean): string {
  if (!startIso) return "-";
  const date = new Date(allDay && !startIso.includes("T") ? `${startIso}T00:00:00` : startIso);
  if (Number.isNaN(date.getTime())) return startIso;
  if (allDay) {
    return date.toLocaleDateString(undefined, { dateStyle: "long" });
  }
  return date.toLocaleString(undefined, { dateStyle: "long", timeStyle: "short" });
}

export function EventDetailModal() {
  const modalEventId = useCalendarNotificationsStore((s) => s.modalEventId);
  const events = useCalendarNotificationsStore((s) => s.events);
  const closeModal = useCalendarNotificationsStore((s) => s.closeModal);
  const approve = useCalendarNotificationsStore((s) => s.approve);
  const reject = useCalendarNotificationsStore((s) => s.reject);
  const isPending = useCalendarNotificationsStore((s) =>
    modalEventId ? s.pendingActionIds.has(modalEventId) : false,
  );

  const isAuthed = useAuthStore((s) => s.status === "authenticated");

  const event = useMemo(
    () => events.find((e) => e.id === modalEventId) ?? null,
    [events, modalEventId],
  );

  const open = Boolean(event);

  if (!event) {
    return null;
  }

  const confidencePct = Math.round(event.event.confidence * 100);

  return (
    <Dialog.Root open={open} onOpenChange={(next) => (!next ? closeModal() : undefined)}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-100 bg-foreground/30" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-110 w-[min(560px,92vw)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-card p-5 shadow-xl">
          <Dialog.Title className="text-lg font-semibold">
            {event.event.title || "Untitled event"}
          </Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-muted-foreground">
            Detected from {event.fileName || "file"}
          </Dialog.Description>

          <div className="mt-4 space-y-3 rounded-xl border border-border/60 bg-background p-4">
            <DetailRow
              label="When"
              value={formatStart(event.event.start_iso, event.event.all_day)}
            />
            {event.event.end_iso && !event.event.all_day && (
              <DetailRow label="Until" value={formatStart(event.event.end_iso, false)} />
            )}
            <DetailRow label="Location" value={event.event.location} />
            <DetailRow
              label="Attendees"
              value={
                event.event.attendees.length > 0 ? event.event.attendees.join(", ") : "-"
              }
            />
            {event.event.description && (
              <DetailRow label="Notes" value={event.event.description} />
            )}

            <div className="grid grid-cols-[110px_1fr] gap-2 text-sm">
              <span className="text-muted-foreground">Confidence</span>
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-32 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full"
                    style={{
                      width: `${confidencePct}%`,
                      background:
                        confidencePct >= 80
                          ? "var(--success)"
                          : confidencePct >= 60
                            ? "var(--warning)"
                            : "var(--destructive)",
                    }}
                  />
                </div>
                <span className="text-[11px] font-bold text-muted-foreground">
                  {confidencePct}%
                </span>
              </div>
            </div>

            {event.sourcePath && (
              <button
                type="button"
                onClick={() => {
                  void tauriClient.openExternalUrl(normalizeOsPath(event.sourcePath));
                }}
                className="flex items-center gap-1.5 text-[12px] font-bold text-primary hover:underline"
              >
                <ExternalLink className="h-3 w-3" />
                Open source file
              </button>
            )}
          </div>

          <div className="mt-5 flex justify-end gap-2">
            <Button
              variant="outline"
              disabled={isPending}
              onClick={() => void reject(event.id)}
            >
              Reject
            </Button>
            <Button
              disabled={isPending || !isAuthed}
              onClick={() => void approve(event.id)}
              title={isAuthed ? undefined : "Sign in to Google first"}
            >
              {isPending ? "Adding…" : "Add to Calendar"}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
