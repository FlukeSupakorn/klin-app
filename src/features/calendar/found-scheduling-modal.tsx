import * as Dialog from "@radix-ui/react-dialog";
import { Button } from "@/components/ui/button";
import type { CalendarMockEvent } from "@/services/calendar-api-service";

interface FoundSchedulingModalProps {
  open: boolean;
  event: CalendarMockEvent | null;
  onClose: () => void;
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[110px_1fr] gap-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="break-words text-foreground">{value || "-"}</span>
    </div>
  );
}

export function FoundSchedulingModal({ open, event, onClose }: FoundSchedulingModalProps) {
  if (!event) {
    return null;
  }

  return (
    <Dialog.Root open={open} onOpenChange={(nextOpen) => (!nextOpen ? onClose() : undefined)}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[100] bg-foreground/30" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[110] w-[min(560px,92vw)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-card p-5 shadow-xl">
          <Dialog.Title className="text-lg font-semibold">Found Scheduling</Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-muted-foreground">
            Calendar request detected from /calendar
          </Dialog.Description>

          <div className="mt-4 space-y-3 rounded-xl border border-border/60 bg-background p-4">
            <DetailRow label="Title" value={event.title} />
            <DetailRow label="Description" value={event.description || "-"} />
            <DetailRow label="Date" value={event.date} />
            <DetailRow label="Start" value={event.startTime} />
            <DetailRow label="End" value={event.endTime} />
            <DetailRow label="Location" value={event.location} />
            <DetailRow label="Timezone" value={event.timeZone || "-"} />
            <DetailRow label="Organizer" value={event.organizer || "-"} />
            <DetailRow label="Status" value={event.status || "-"} />
            <DetailRow label="Calendar" value={event.calendarId || "-"} />
            <DetailRow label="Meet Link" value={event.meetLink || "-"} />
            <DetailRow
              label="Attendees"
              value={event.attendees && event.attendees.length > 0 ? event.attendees.join(", ") : "-"}
            />
          </div>

          <div className="mt-5 flex justify-end">
            <Button onClick={onClose}>Close</Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
