import { create } from "zustand";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import { calendarEventsApiService } from "@/services/calendar-events-api-service";
import {
  CalendarTokenExpiredError,
  createGoogleCalendarEvent,
} from "@/features/calendar/google-calendar-service";
import { useAuthStore } from "@/hooks/auth/use-auth-store";
import type {
  DetectedCalendarEvent,
  DetectedCalendarEventStatus,
} from "@/types/calendar-events";

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

  refresh: async () => {
    set({ isLoading: true });
    try {
      const events = await calendarEventsApiService.listPending();
      set({ events, isLoading: false });
    } catch (error) {
      logger.error("[calendar-notifications] refresh failed", error);
      set({ isLoading: false });
    }
  },

  togglePanel: () => {
    const open = !get().isPanelOpen;
    set({ isPanelOpen: open });
    if (open) {
      void get().refresh();
    }
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
      toast.error("Sign in to Google first to add events.");
      return;
    }

    setActionPending(set, id, true);
    try {
      const created = await createGoogleCalendarEvent(token, {
        title: event.event.title || "Untitled event",
        startIso: event.event.start_iso,
        endIso: event.event.end_iso || undefined,
        allDay: event.event.all_day,
        location: event.event.location || undefined,
        attendees: event.event.attendees,
        description: event.event.description || undefined,
        timeZone: getUserTimeZone(),
      });

      await calendarEventsApiService.updateStatus(id, "approved", created.id);

      set((state) => ({
        events: state.events.filter((e) => e.id !== id),
        modalEventId: state.modalEventId === id ? null : state.modalEventId,
      }));

      if (created.htmlLink) {
        toast.success("Added to Google Calendar", {
          action: {
            label: "Open",
            onClick: () => {
              window.open(created.htmlLink, "_blank", "noopener,noreferrer");
            },
          },
        });
      } else {
        toast.success("Added to Google Calendar");
      }
    } catch (error) {
      if (error instanceof CalendarTokenExpiredError) {
        toast.error("Google session expired. Please reconnect.");
      } else {
        logger.error("[calendar-notifications] approve failed", error);
        toast.error(
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
      await calendarEventsApiService.updateStatus(id, "rejected");
      set((state) => ({
        events: state.events.filter((e) => e.id !== id),
        modalEventId: state.modalEventId === id ? null : state.modalEventId,
      }));
    } catch (error) {
      logger.error("[calendar-notifications] reject failed", error);
      toast.error("Failed to dismiss event.");
    } finally {
      setActionPending(set, id, false);
    }
  },
}));

export function selectUnreadCount(state: { events: DetectedCalendarEvent[] }) {
  return state.events.filter((e) => e.status === "pending").length;
}

export type { DetectedCalendarEvent, DetectedCalendarEventStatus };
