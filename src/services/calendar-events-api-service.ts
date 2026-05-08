import type {
  DetectedCalendarEvent,
  DetectedCalendarEventPayload,
  DetectedCalendarEventStatus,
} from "@/types/calendar-events";

const CALENDAR_EVENTS_API_URL_CANDIDATES = [
  "http://127.0.0.1:8000/api/calendar-events",
  "http://localhost:8000/api/calendar-events",
];

interface RawDetectedEvent {
  id: string;
  file_id: string;
  file_name: string;
  source_path: string;
  event: DetectedCalendarEventPayload;
  status: DetectedCalendarEventStatus;
  detected_at: string;
  google_event_id: string | null;
}

function normalize(raw: RawDetectedEvent): DetectedCalendarEvent {
  return {
    id: raw.id,
    fileId: raw.file_id,
    fileName: raw.file_name,
    sourcePath: raw.source_path,
    event: raw.event,
    status: raw.status,
    detectedAt: raw.detected_at,
    googleEventId: raw.google_event_id ?? null,
  };
}

async function fetchPendingFrom(url: string, limit: number): Promise<DetectedCalendarEvent[]> {
  const response = await fetch(`${url}/pending?limit=${limit}`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });

  if (!response.ok) {
    throw new Error(`Calendar events API error: ${response.status} at ${url}`);
  }

  const payload = (await response.json()) as { items?: RawDetectedEvent[] };
  return (payload.items ?? []).map(normalize);
}

async function patchStatusAt(
  url: string,
  id: string,
  status: DetectedCalendarEventStatus,
  googleEventId?: string,
): Promise<void> {
  const response = await fetch(`${url}/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      status,
      google_event_id: googleEventId,
    }),
  });

  if (!response.ok) {
    throw new Error(`Calendar events PATCH error: ${response.status} at ${url}`);
  }
}

export const calendarEventsApiService = {
  async listPending(limit: number = 20): Promise<DetectedCalendarEvent[]> {
    let lastError: unknown = null;
    for (const url of CALENDAR_EVENTS_API_URL_CANDIDATES) {
      try {
        return await fetchPendingFrom(url, limit);
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError ?? new Error("Calendar events API unavailable");
  },

  async updateStatus(
    id: string,
    status: DetectedCalendarEventStatus,
    googleEventId?: string,
  ): Promise<void> {
    let lastError: unknown = null;
    for (const url of CALENDAR_EVENTS_API_URL_CANDIDATES) {
      try {
        await patchStatusAt(url, id, status, googleEventId);
        return;
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError ?? new Error("Calendar events API unavailable");
  },
};
