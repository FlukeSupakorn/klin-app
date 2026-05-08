import { theme } from "@/theme/theme";

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

interface GoogleCalendarColorDefinition {
  background?: string;
}

interface GoogleCalendarColorsResponse {
  event?: Record<string, GoogleCalendarColorDefinition>;
}

interface GoogleCalendarListEntry {
  colorId?: string;
  backgroundColor?: string;
}

interface GoogleApiErrorItem {
  reason?: string;
  message?: string;
}

interface GoogleApiErrorPayload {
  error?: {
    code?: number;
    message?: string;
    status?: string;
    errors?: GoogleApiErrorItem[];
  };
}

export class CalendarTokenExpiredError extends Error {
  constructor() {
    super("Google token expired");
    this.name = "CalendarTokenExpiredError";
  }
}

export class CalendarApiError extends Error {
  status: number;
  reason: string | null;

  constructor(status: number, message: string, reason: string | null = null) {
    super(message);
    this.name = "CalendarApiError";
    this.status = status;
    this.reason = reason;
  }
}

const DEFAULT_EVENT_COLOR = theme.calendar.defaultEventColor;

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

function normalizeEvent(
  item: GoogleCalendarEventItem,
  eventColors: Record<string, string>,
  fallbackColor: string,
): NormalizedCalendarEvent | null {
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
    color: eventColors[item.colorId ?? ""] ?? fallbackColor,
    htmlLink: item.htmlLink,
    isAllDay,
  };
}

function overlapsRange(event: NormalizedCalendarEvent, rangeStart: Date, rangeEnd: Date): boolean {
  return event.end > rangeStart && event.start < rangeEnd;
}

class GoogleCalendarService {
  private async fetchEventColors(accessToken: string): Promise<Record<string, string>> {
    const response = await fetch("https://www.googleapis.com/calendar/v3/colors", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (response.status === 401) {
      throw new CalendarTokenExpiredError();
    }

    if (!response.ok) {
      return {};
    }

    const colorsPayload = (await response.json()) as GoogleCalendarColorsResponse;
    const colorMap = Object.entries(colorsPayload.event ?? {}).reduce<Record<string, string>>((acc, [id, definition]) => {
      if (typeof definition?.background === "string" && definition.background.length > 0) {
        acc[id] = definition.background;
      }

      return acc;
    }, {});

    return colorMap;
  }

  private async fetchPrimaryCalendarColor(accessToken: string, eventColors: Record<string, string>): Promise<string> {
    const response = await fetch("https://www.googleapis.com/calendar/v3/users/me/calendarList/primary?colorRgbFormat=true", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (response.status === 401) {
      throw new CalendarTokenExpiredError();
    }

    if (!response.ok) {
      return DEFAULT_EVENT_COLOR;
    }

    const payload = (await response.json()) as GoogleCalendarListEntry;

    if (typeof payload.backgroundColor === "string" && payload.backgroundColor.length > 0) {
      return payload.backgroundColor;
    }

    if (typeof payload.colorId === "string" && payload.colorId.length > 0) {
      return eventColors[payload.colorId] ?? DEFAULT_EVENT_COLOR;
    }

    return DEFAULT_EVENT_COLOR;
  }

  async fetchMonthEvents(accessToken: string, visibleMonth: Date): Promise<NormalizedCalendarEvent[]> {
    const { start, end } = getMonthBounds(visibleMonth);
    const events: NormalizedCalendarEvent[] = [];
    const eventColors = await this.fetchEventColors(accessToken);
    const fallbackColor = await this.fetchPrimaryCalendarColor(accessToken, eventColors);

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
        let payload: GoogleApiErrorPayload | null = null;

        try {
          payload = (await response.json()) as GoogleApiErrorPayload;
        } catch {
          payload = null;
        }

        const apiMessage = payload?.error?.message ?? `Calendar API error (${response.status})`;
        const apiReason = payload?.error?.errors?.[0]?.reason ?? null;
        throw new CalendarApiError(response.status, apiMessage, apiReason);
      }

      const data = (await response.json()) as GoogleCalendarListResponse;
      const normalized = (data.items ?? [])
        .map((item) => normalizeEvent(item, eventColors, fallbackColor))
        .filter((item): item is NormalizedCalendarEvent => Boolean(item))
        .filter((item) => overlapsRange(item, start, end));

      events.push(...normalized);
      pageToken = data.nextPageToken;
    } while (pageToken);

    return events;
  }
}

export interface CalendarEventCreateInput {
  title: string;
  startIso: string; // local-naive ISO (e.g. 2026-04-12T14:00:00) or date-only when allDay
  endIso?: string;
  allDay: boolean;
  location?: string;
  attendees?: string[];
  description?: string;
  timeZone: string; // IANA, attached at create time
}

export interface CreatedCalendarEvent {
  id: string;
  htmlLink?: string;
}

function pickEventDate(input: CalendarEventCreateInput, isStart: boolean): GoogleCalendarEventDateTime {
  if (input.allDay) {
    const raw = isStart ? input.startIso : (input.endIso || input.startIso);
    const datePart = raw.includes("T") ? raw.split("T")[0] : raw;
    return { date: datePart };
  }

  const value = isStart ? input.startIso : input.endIso;
  if (value && value.length > 0) {
    return { dateTime: value, timeZone: input.timeZone } as GoogleCalendarEventDateTime & { timeZone: string };
  }

  // Fallback for missing end: +1 hour from start, naive concatenation.
  if (!isStart) {
    const start = new Date(input.startIso);
    if (!Number.isNaN(start.getTime())) {
      const end = new Date(start.getTime() + 60 * 60 * 1000);
      const pad = (n: number) => String(n).padStart(2, "0");
      const local =
        `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}` +
        `T${pad(end.getHours())}:${pad(end.getMinutes())}:${pad(end.getSeconds())}`;
      return { dateTime: local, timeZone: input.timeZone } as GoogleCalendarEventDateTime & { timeZone: string };
    }
  }

  return { dateTime: input.startIso, timeZone: input.timeZone } as GoogleCalendarEventDateTime & { timeZone: string };
}

export async function createGoogleCalendarEvent(
  accessToken: string,
  input: CalendarEventCreateInput,
): Promise<CreatedCalendarEvent> {
  const body: Record<string, unknown> = {
    summary: input.title,
    start: pickEventDate(input, true),
    end: pickEventDate(input, false),
  };

  if (input.location && input.location.trim()) {
    body.location = input.location.trim();
  }
  if (input.description && input.description.trim()) {
    body.description = input.description.trim();
  }
  if (input.attendees && input.attendees.length > 0) {
    const emailAttendees = input.attendees
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0 && entry.includes("@"))
      .map((entry) => ({ email: entry }));
    if (emailAttendees.length > 0) {
      body.attendees = emailAttendees;
    }
  }

  const response = await fetch(
    "https://www.googleapis.com/calendar/v3/calendars/primary/events",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );

  if (response.status === 401) {
    throw new CalendarTokenExpiredError();
  }

  if (!response.ok) {
    let payload: GoogleApiErrorPayload | null = null;
    try {
      payload = (await response.json()) as GoogleApiErrorPayload;
    } catch {
      payload = null;
    }
    const apiMessage = payload?.error?.message ?? `Calendar API error (${response.status})`;
    const apiReason = payload?.error?.errors?.[0]?.reason ?? null;
    throw new CalendarApiError(response.status, apiMessage, apiReason);
  }

  const data = (await response.json()) as { id: string; htmlLink?: string };
  return { id: data.id, htmlLink: data.htmlLink };
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
