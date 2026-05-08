export interface DetectedCalendarEventPayload {
  title: string;
  start_iso: string;
  end_iso: string;
  all_day: boolean;
  location: string;
  attendees: string[];
  description: string;
  confidence: number;
}

export type DetectedCalendarEventStatus = "pending" | "approved" | "rejected";

export interface DetectedCalendarEvent {
  id: string;
  fileId: string;
  fileName: string;
  sourcePath: string;
  event: DetectedCalendarEventPayload;
  status: DetectedCalendarEventStatus;
  detectedAt: string;
  googleEventId: string | null;
}
