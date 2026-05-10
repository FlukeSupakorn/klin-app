export type ScheduleEventType = "meeting" | "flight" | "appointment" | "other";

export type DetectedCalendarEventStatus = "pending" | "approved" | "rejected";

export interface GoogleCalendarDateTime {
  dateTime: string;
  timeZone: string | null;
}

export interface GoogleCalendarAttendee {
  email: string;
  displayName: string | null;
}

export interface GoogleCalendarEventDraft {
  summary: string;
  description: string | null;
  location: string | null;
  start: GoogleCalendarDateTime;
  end: GoogleCalendarDateTime;
  attendees: GoogleCalendarAttendee[];
  reminders: { useDefault: boolean };
}

export interface DetectedCalendarEvent {
  id: string;
  fileId: string;
  fileName: string;
  sourcePath: string;
  type: ScheduleEventType;
  confidence: number;
  sourcePages: number[];
  sourceText: string;
  missingFields: string[];
  googleEvent: GoogleCalendarEventDraft;
  status: DetectedCalendarEventStatus;
  detectedAt: string;
  googleEventId: string | null;
}
