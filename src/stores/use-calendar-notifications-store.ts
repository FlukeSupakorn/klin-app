import { create } from "zustand";
import { createElement } from "react";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import { EventAddedToast, CalendarErrorToast } from "@/features/calendar/event-added-toast";
import {
  CalendarTokenExpiredError,
  createGoogleCalendarEvent,
} from "@/features/calendar/google-calendar-service";
import { useAuthStore } from "@/hooks/auth/use-auth-store";
import type {
  DetectedCalendarEvent,
  DetectedCalendarEventStatus,
} from "@/types/calendar-events";
import type { ScheduleExtractionDto } from "@/types/domain";

const INGEST_CONFIDENCE_THRESHOLD = 0.5;

interface IngestScheduleInput {
  filePath: string;
  fileId: string | null;
  fileName: string;
  schedule: ScheduleExtractionDto | null | undefined;
}

interface CalendarNotificationsState {
  events: DetectedCalendarEvent[];
  isPanelOpen: boolean;
  isLoading: boolean;
  modalEventId: string | null;
  pendingActionIds: Set<string>;
  refresh: () => Promise<void>;
  togglePanel: () => void;
  closePanel: () => void;
  openModal: (id: string) => void;
  closeModal: () => void;
  approve: (id: string) => Promise<void>;
  reject: (id: string) => Promise<void>;
  ingestSchedule: (input: IngestScheduleInput) => void;
}

function showErrorToast(eyebrow: string, message: string): void {
  toast.custom(
    (toastId) =>
      createElement(CalendarErrorToast, {
        eyebrow,
        message,
        onDismiss: () => toast.dismiss(toastId),
      }),
    { duration: 6000 },
  );
}

function getUserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

function setActionPending(
  set: (
    partial:
      | Partial<CalendarNotificationsState>
      | ((s: CalendarNotificationsState) => Partial<CalendarNotificationsState>),
  ) => void,
  id: string,
  pending: boolean,
) {
  set((state) => {
    const next = new Set(state.pendingActionIds);
    if (pending) {
      next.add(id);
    } else {
      next.delete(id);
    }
    return { pendingActionIds: next };
  });
}

export const useCalendarNotificationsStore = create<CalendarNotificationsState>((set, get) => ({
  events: [],
  isPanelOpen: false,
  isLoading: false,
  modalEventId: null,
  pendingActionIds: new Set<string>(),

  // Events now arrive via ingestSchedule() at organize time. Refresh is a no-op
  // kept for compatibility with existing call sites (panel refresh button,
  // dashboard "klin:history-updated" listener).
  refresh: async () => {
    return;
  },

  togglePanel: () => {
    set({ isPanelOpen: !get().isPanelOpen });
  },

  closePanel: () => set({ isPanelOpen: false }),

  openModal: (id) => set({ modalEventId: id }),

  closeModal: () => set({ modalEventId: null }),

  approve: async (id) => {
    const event = get().events.find((e) => e.id === id);
    if (!event) {
      return;
    }

    if (get().pendingActionIds.has(id)) {
      return;
    }

    const token = await useAuthStore.getState().ensureValidToken();
    if (!token) {
      showErrorToast("Sign-in Required", "Sign in to Google first to add events.");
      return;
    }

    setActionPending(set, id, true);
    try {
      const draft = event.googleEvent;
      const fallbackTz = draft.start.timeZone || draft.end.timeZone || getUserTimeZone();
      const created = await createGoogleCalendarEvent(token, {
        title: draft.summary || "Untitled event",
        startIso: draft.start.dateTime,
        endIso: draft.end.dateTime || undefined,
        allDay: false,
        location: draft.location || undefined,
        attendees: draft.attendees
          .map((a) => a.email)
          .filter((email) => email && email.includes("@")),
        description: draft.description || undefined,
        timeZone: fallbackTz,
      });

      set((state) => ({
        events: state.events.filter((e) => e.id !== id),
        modalEventId: state.modalEventId === id ? null : state.modalEventId,
      }));

      window.dispatchEvent(new Event("klin:history-updated"));

      const eventTitle = draft.summary || "Untitled event";
      toast.custom(
        (toastId) =>
          createElement(EventAddedToast, {
            title: eventTitle,
            htmlLink: created.htmlLink ?? null,
            onDismiss: () => toast.dismiss(toastId),
          }),
        { duration: 6000 },
      );
    } catch (error) {
      if (error instanceof CalendarTokenExpiredError) {
        showErrorToast("Session Expired", "Google session expired. Please reconnect.");
      } else {
        logger.error("[calendar-notifications] approve failed", error);
        showErrorToast(
          "Calendar Error",
          error instanceof Error ? error.message : "Failed to add event to Google Calendar",
        );
      }
    } finally {
      setActionPending(set, id, false);
    }
  },

  reject: async (id) => {
    if (get().pendingActionIds.has(id)) {
      return;
    }

    setActionPending(set, id, true);
    try {
      set((state) => ({
        events: state.events.filter((e) => e.id !== id),
        modalEventId: state.modalEventId === id ? null : state.modalEventId,
      }));
    } finally {
      setActionPending(set, id, false);
    }
  },

  ingestSchedule: (input) => {
    if (!input.schedule || input.schedule.events.length === 0) {
      return;
    }
    const fileIdKey = input.fileId ?? input.filePath;
    const detectedAt = new Date().toISOString();
    const additions: DetectedCalendarEvent[] = [];

    input.schedule.events.forEach((ev, idx) => {
      if (!ev.google_event) {
        return;
      }
      if (typeof ev.confidence === "number" && ev.confidence < INGEST_CONFIDENCE_THRESHOLD) {
        return;
      }
      additions.push({
        id: `${fileIdKey}:${idx}`,
        fileId: input.fileId ?? "",
        fileName: input.fileName,
        sourcePath: input.filePath,
        type: ev.type,
        confidence: ev.confidence,
        sourcePages: ev.source_pages ?? [],
        sourceText: ev.source_text ?? "",
        missingFields: ev.missing_fields ?? [],
        googleEvent: ev.google_event,
        status: "pending",
        detectedAt,
        googleEventId: null,
      });
    });

    if (additions.length === 0) {
      return;
    }

    set((state) => {
      const existingIds = new Set(state.events.map((e) => e.id));
      const merged = [
        ...state.events,
        ...additions.filter((a) => !existingIds.has(a.id)),
      ];
      return { events: merged };
    });
  },
}));

export function selectUnreadCount(state: { events: DetectedCalendarEvent[] }) {
  return state.events.filter((e) => e.status === "pending").length;
}

export type { DetectedCalendarEvent, DetectedCalendarEventStatus };
