export interface CalendarMockEvent {
  title: string;
  description: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  timeZone?: string;
  organizer?: string;
  attendees?: string[];
  meetLink?: string;
  status?: string;
  calendarId?: string;
}

export interface CalendarPostedEnvelope {
  found: boolean;
  requestId?: string;
  event: CalendarMockEvent | null;
}

const CALENDAR_API_URL_CANDIDATES = [
  "http://localhost:3000/calendar",
  "http://localhost:3000/calendar/found",
];

function normalizeCalendarEvent(payload: unknown): CalendarMockEvent | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const root = payload as {
    found?: unknown;
    event?: unknown;
    title?: unknown;
    description?: unknown;
    date?: unknown;
    startTime?: unknown;
    endTime?: unknown;
    location?: unknown;
    timeZone?: unknown;
    organizer?: unknown;
    attendees?: unknown;
    meetLink?: unknown;
    status?: unknown;
    calendarId?: unknown;
  };

  if (root.found === false) {
    return null;
  }

  if (root.event && typeof root.event === "object") {
    return normalizeCalendarEvent(root.event);
  }

  const title = String(root.title ?? "").trim();
  const description = String(root.description ?? "").trim();
  const date = String(root.date ?? "").trim();
  const startTime = String(root.startTime ?? "").trim();
  const endTime = String(root.endTime ?? "").trim();
  const location = String(root.location ?? "").trim();

  if (!title || !date || !startTime || !endTime || !location) {
    return null;
  }

  return {
    title,
    description,
    date,
    startTime,
    endTime,
    location,
    timeZone: String(root.timeZone ?? "").trim() || undefined,
    organizer: String(root.organizer ?? "").trim() || undefined,
    attendees: Array.isArray(root.attendees)
      ? root.attendees.map((item) => String(item)).filter(Boolean)
      : undefined,
    meetLink: String(root.meetLink ?? "").trim() || undefined,
    status: String(root.status ?? "").trim() || undefined,
    calendarId: String(root.calendarId ?? "").trim() || undefined,
  };
}

function normalizeCalendarEnvelope(payload: unknown): CalendarPostedEnvelope {
  if (!payload || typeof payload !== "object") {
    return { found: false, event: null };
  }

  const root = payload as {
    found?: unknown;
    requestId?: unknown;
    event?: unknown;
  };

  const event = normalizeCalendarEvent(root.event ?? payload);
  const found = root.found === false ? false : Boolean(event);
  const requestId = typeof root.requestId === "string" && root.requestId.trim()
    ? root.requestId.trim()
    : undefined;

  return { found, requestId, event: found ? event : null };
}

async function fetchCalendarFrom(url: string): Promise<CalendarPostedEnvelope> {
  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Calendar API error: ${response.status} at ${url}`);
  }

  const payload = await response.json();
  return normalizeCalendarEnvelope(payload);
}

export const calendarApiService = {
  async getFoundScheduling(): Promise<CalendarPostedEnvelope> {
    let lastError: unknown = null;

    for (const url of CALENDAR_API_URL_CANDIDATES) {
      try {
        return await fetchCalendarFrom(url);
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError ?? new Error("Calendar API unavailable");
  },
};
