import type { CategoryScore } from "@/types/domain";

export type HistoryEntryType = "organize" | "summary" | "calendar";

interface HistoryEntryBase {
  id: string;
  type: HistoryEntryType;
  title: string;
  subtitle: string;
  timestamp: string;
}

export interface OrganizeHistoryEntry extends HistoryEntryBase {
  type: "organize";
  fromPath: string;
  toPath: string;
  oldName: string;
  newName: string;
  scores: CategoryScore[];
}

export interface SummaryHistoryEntry extends HistoryEntryBase {
  type: "summary";
  fileNames: string[];
  summaryPath: string;
  categoryName?: string;
}

export interface CalendarHistoryEntry extends HistoryEntryBase {
  type: "calendar";
  foundInFile: boolean;
  sourceFileName: string;
  meetingTitle: string;
  meetingTime: string;
  meetingLocation: string;
  details: string;
  actionLabel: string;
  attendees?: string[];
  meetLink?: string;
  organizer?: string;
  timeZone?: string;
  status?: string;
  calendarId?: string;
}

export type HistoryEntry = OrganizeHistoryEntry | SummaryHistoryEntry | CalendarHistoryEntry;
