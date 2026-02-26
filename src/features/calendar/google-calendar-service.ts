export interface NormalizedCalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  color: string;
  htmlLink?: string;
  isAllDay: boolean;
}

interface GoogleCalendarEventDateTime {
  date?: string;
  dateTime?: string;
}

interface GoogleCalendarEventItem {
  id: string;
  summary?: string;
  colorId?: string;
  htmlLink?: string;
  start?: GoogleCalendarEventDateTime;
  end?: GoogleCalendarEventDateTime;
}

interface GoogleCalendarListResponse {
  items?: GoogleCalendarEventItem[];
  nextPageToken?: string;
}

export class CalendarTokenExpiredError extends Error {
  constructor() {
    super("Google token expired");
    this.name = "CalendarTokenExpiredError";
  }
}

const EVENT_COLORS: Record<string, string> = {
  "1": "#7986CB",
  "2": "#33B679",
  "3": "#8E24AA",
  "4": "#E67C73",
  "5": "#F6BF26",
  "6": "#F4511E",
  "7": "#039BE5",
  "8": "#616161",
  "9": "#3F51B5",
  "10": "#0B8043",
  "11": "#D50000",
};

function getMonthBounds(month: Date) {
  const start = new Date(month.getFullYear(), month.getMonth(), 1, 0, 0, 0, 0);
  const end = new Date(month.getFullYear(), month.getMonth() + 1, 1, 0, 0, 0, 0);
  return { start, end };
}

function parseEventDate(value: GoogleCalendarEventDateTime | undefined): { date: Date; isAllDay: boolean } | null {
  if (!value) {
    return null;
  }

  if (value.dateTime) {
    return { date: new Date(value.dateTime), isAllDay: false };
  }

  if (value.date) {
    return { date: new Date(`${value.date}T00:00:00`), isAllDay: true };
  }

  return null;
}

function normalizeEvent(item: GoogleCalendarEventItem): NormalizedCalendarEvent | null {
  const startParsed = parseEventDate(item.start);
  const endParsed = parseEventDate(item.end);

  if (!startParsed || !endParsed) {
    return null;
  }

  const isAllDay = startParsed.isAllDay || endParsed.isAllDay;
  const endDate = new Date(endParsed.date);

  if (endDate <= startParsed.date) {
    if (isAllDay) {
      endDate.setDate(endDate.getDate() + 1);
    } else {
      endDate.setMinutes(endDate.getMinutes() + 30);
    }
  }

  return {
    id: item.id,
    title: item.summary?.trim() || "Untitled event",
    start: startParsed.date,
    end: endDate,
    color: EVENT_COLORS[item.colorId ?? ""] ?? "#3B82F6",
    htmlLink: item.htmlLink,
    isAllDay,
  };
}

function overlapsRange(event: NormalizedCalendarEvent, rangeStart: Date, rangeEnd: Date): boolean {
  return event.end > rangeStart && event.start < rangeEnd;
}

class GoogleCalendarService {
  async fetchMonthEvents(accessToken: string, visibleMonth: Date): Promise<NormalizedCalendarEvent[]> {
    const { start, end } = getMonthBounds(visibleMonth);
    const events: NormalizedCalendarEvent[] = [];

    let pageToken: string | undefined;

    do {
      const params = new URLSearchParams({
        singleEvents: "true",
        orderBy: "startTime",
        showDeleted: "false",
        maxResults: "2500",
        timeMin: start.toISOString(),
        timeMax: end.toISOString(),
      });

      if (pageToken) {
        params.set("pageToken", pageToken);
      }

      const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (response.status === 401) {
        throw new CalendarTokenExpiredError();
      }

      if (!response.ok) {
        throw new Error(`Calendar API error (${response.status})`);
      }

      const data = (await response.json()) as GoogleCalendarListResponse;
      const normalized = (data.items ?? [])
        .map(normalizeEvent)
        .filter((item): item is NormalizedCalendarEvent => Boolean(item))
        .filter((item) => overlapsRange(item, start, end));

      events.push(...normalized);
      pageToken = data.nextPageToken;
    } while (pageToken);

    return events;
  }
}

export function getMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function getDayBounds(date: Date): { start: Date; end: Date } {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
  const end = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1, 0, 0, 0, 0);
  return { start, end };
}

export const googleCalendarService = new GoogleCalendarService();
