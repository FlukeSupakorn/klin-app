import { create } from "zustand";
import {
  CalendarApiError,
  CalendarTokenExpiredError,
  getDayBounds,
  getMonthKey,
  googleCalendarService,
  type NormalizedCalendarEvent,
} from "@/features/calendar/google-calendar-service";
import { useAuthStore } from "@/hooks/auth/use-auth-store";

function mapCalendarApiError(error: CalendarApiError): string {
  if (error.status === 403) {
    const reason = error.reason?.toLowerCase() ?? "";

    if (reason.includes("accessnotconfigured") || reason.includes("servicedisabled")) {
      return "Google Calendar API is not enabled in your Google Cloud project. Enable it in APIs & Services > Library.";
    }

    if (reason.includes("insufficientpermissions")) {
      return "Google account permission is missing Calendar access. Disconnect and sign in again.";
    }

    if (reason.includes("dailylimitexceeded") || reason.includes("quot")) {
      return "Google Calendar API quota exceeded. Try again later or increase quota in Google Cloud Console.";
    }

    return `Google Calendar access denied (403): ${error.message}`;
  }

  if (error.status === 400) {
    return `Google Calendar request is invalid: ${error.message}`;
  }

  return `Google Calendar error (${error.status}): ${error.message}`;
}

interface CalendarStoreState {
  monthCache: Record<string, NormalizedCalendarEvent[]>;
  visibleMonth: Date;
  selectedDate: Date | undefined;
  isEventModalOpen: boolean;
  isLoadingMonth: boolean;
  isOffline: boolean;
  error: string | null;
  setVisibleMonth: (month: Date) => void;
  setSelectedDate: (date: Date | undefined) => void;
  openDateModal: (date: Date) => void;
  closeDateModal: () => void;
  loadVisibleMonth: (month: Date, force?: boolean) => Promise<void>;
  prefetchMonth: (month: Date) => Promise<void>;
  initializeMonths: () => Promise<void>;
  getEventsForDate: (date: Date) => NormalizedCalendarEvent[];
  getEventCountForDate: (date: Date) => number;
}

export const useCalendarStore = create<CalendarStoreState>((set, get) => ({
  monthCache: {},
  visibleMonth: new Date(),
  selectedDate: new Date(),
  isEventModalOpen: false,
  isLoadingMonth: false,
  isOffline: false,
  error: null,

  setVisibleMonth: (month) => {
    set({ visibleMonth: month });
  },

  setSelectedDate: (date) => {
    set({ selectedDate: date });
  },

  openDateModal: (date) => {
    set({ selectedDate: date, isEventModalOpen: true });
  },

  closeDateModal: () => {
    set({ isEventModalOpen: false });
  },

  loadVisibleMonth: async (month, force = false) => {
    const monthKey = getMonthKey(month);
    const state = get();

    if (!force && state.monthCache[monthKey]) {
      set({ visibleMonth: month, isOffline: false });
      return;
    }

    const authState = useAuthStore.getState();
    const token = await authState.ensureValidToken();

    if (!token) {
      set({
        visibleMonth: month,
        error: "Sign in to load calendar events.",
        isOffline: false,
      });
      return;
    }

    set({
      visibleMonth: month,
      isLoadingMonth: true,
      error: null,
      isOffline: false,
    });

    try {
      const events = await googleCalendarService.fetchMonthEvents(token, month);
      set((current) => ({
        monthCache: {
          ...current.monthCache,
          [monthKey]: events,
        },
        isLoadingMonth: false,
        isOffline: false,
        error: null,
      }));
    } catch (error) {
      if (error instanceof CalendarTokenExpiredError) {
        await useAuthStore.getState().logout();
        set({
          isLoadingMonth: false,
          error: "Session expired. Please sign in again.",
        });
        return;
      }

      if (error instanceof CalendarApiError) {
        set({
          isLoadingMonth: false,
          isOffline: false,
          error: mapCalendarApiError(error),
        });
        return;
      }

      if (error instanceof TypeError) {
        setTimeout(() => {
          const retryToken = useAuthStore.getState().accessToken;
          if (!retryToken) {
            set({ isLoadingMonth: false, isOffline: true, error: "You are offline." });
            return;
          }
          googleCalendarService
            .fetchMonthEvents(retryToken, month)
            .then((events) => {
              set((current) => ({
                monthCache: { ...current.monthCache, [getMonthKey(month)]: events },
                isLoadingMonth: false,
                isOffline: false,
                error: null,
              }));
            })
            .catch(() => {
              set({ isLoadingMonth: false, isOffline: true, error: "You are offline." });
            });
        }, 2000);
        return;
      }
      set({
        isLoadingMonth: false,
        isOffline: false,
        error: "Could not load calendar events.",
      });
    }
  },

  prefetchMonth: async (month) => {
    const monthKey = getMonthKey(month);
    if (get().monthCache[monthKey]) return;

    const token = await useAuthStore.getState().ensureValidToken();
    if (!token) return;

    try {
      const events = await googleCalendarService.fetchMonthEvents(token, month);
      set((current) => ({
        monthCache: {
          ...current.monthCache,
          [monthKey]: events,
        },
      }));
    } catch {
    }
  },

  initializeMonths: async () => {
    const { visibleMonth, loadVisibleMonth, prefetchMonth } = get();
    const prev = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1);
    const next = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1);

    await Promise.all([
      loadVisibleMonth(visibleMonth),
      prefetchMonth(prev),
      prefetchMonth(next),
    ]);
  },

  getEventsForDate: (date) => {
    const monthEvents = get().monthCache[getMonthKey(date)] ?? [];
    const { start, end } = getDayBounds(date);

    return monthEvents
      .filter((event) => event.end > start && event.start < end)
      .sort((left, right) => left.start.getTime() - right.start.getTime());
  },

  getEventCountForDate: (date) => {
    return get().getEventsForDate(date).length;
  },
}));
