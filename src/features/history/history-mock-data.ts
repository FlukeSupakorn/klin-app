export type HistoryEntryType = "organize" | "summary" | "calendar";

interface HistoryEntryBase {
  id: string;
  type: HistoryEntryType;
  title: string;
  subtitle: string;
  timestamp: string;
}

interface HistoryScore {
  name: string;
  score: number;
}

export interface OrganizeHistoryEntry extends HistoryEntryBase {
  type: "organize";
  fromPath: string;
  toPath: string;
  oldName: string;
  newName: string;
  scores: HistoryScore[];
}

export interface SummaryHistoryEntry extends HistoryEntryBase {
  type: "summary";
  fileNames: string[];
  summaryPath: string;
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
}

export type HistoryEntry = OrganizeHistoryEntry | SummaryHistoryEntry | CalendarHistoryEntry;

export const MOCK_HISTORY_ENTRIES: HistoryEntry[] = [
  {
    id: "h-001",
    type: "organize",
    title: "Quarterly_Budget_Review_v3.pdf",
    subtitle: "Finance file organized and renamed",
    timestamp: "2026-02-27T09:24:00.000Z",
    fromPath: "C:/Users/supak/Downloads/Quarterly_Budget_Review_v3.pdf",
    toPath: "C:/Users/supak/Documents/KLIN/Finance/2026_Q1_Budget_Review.pdf",
    oldName: "Quarterly_Budget_Review_v3.pdf",
    newName: "2026_Q1_Budget_Review.pdf",
    scores: [
      { name: "Finance", score: 0.93 },
      { name: "Reports", score: 0.82 },
      { name: "Accounting", score: 0.74 },
      { name: "Meetings", score: 0.31 },
      { name: "Personal", score: 0.08 },
    ],
  },
  {
    id: "h-002",
    type: "summary",
    title: "Project sync notes summarized",
    subtitle: "3 files included in this summary action",
    timestamp: "2026-02-27T08:45:00.000Z",
    fileNames: [
      "Sprint_Review_Notes.md",
      "Retro_Action_Items.txt",
      "Roadmap_Update.docx",
    ],
    summaryPath: "C:/Users/supak/Documents/KLIN/Summaries/sprint_summary_2026-02-27.md",
  },
  {
    id: "h-003",
    type: "calendar",
    title: "Product Roadmap Sync",
    subtitle: "From notes.txt · Mar 1, 10:30 AM",
    timestamp: "2026-02-27T07:12:00.000Z",
    foundInFile: true,
    sourceFileName: "notes.txt",
    meetingTitle: "Product Roadmap Sync",
    meetingTime: "Mar 1, 2026 · 10:30 AM",
    meetingLocation: "Google Meet",
    details: "Detected from meeting notes with agenda and attendees.",
    actionLabel: "Detected schedule details for follow-up meeting",
  },
  {
    id: "h-004",
    type: "organize",
    title: "Invoice_8891.png",
    subtitle: "Receipt image moved to Accounting",
    timestamp: "2026-02-26T21:03:00.000Z",
    fromPath: "C:/Users/supak/Desktop/Invoice_8891.png",
    toPath: "C:/Users/supak/Documents/KLIN/Accounting/Receipt_Invoice_8891.png",
    oldName: "Invoice_8891.png",
    newName: "Receipt_Invoice_8891.png",
    scores: [
      { name: "Accounting", score: 0.91 },
      { name: "Finance", score: 0.72 },
      { name: "Operations", score: 0.41 },
      { name: "Personal", score: 0.15 },
    ],
  },
  {
    id: "h-006",
    type: "organize",
    title: "team_minutes_march.docx",
    subtitle: "Moved without rename",
    timestamp: "2026-02-26T18:20:00.000Z",
    fromPath: "C:/Users/supak/Downloads/team_minutes_march.docx",
    toPath: "C:/Users/supak/Documents/KLIN/Meetings/team_minutes_march.docx",
    oldName: "team_minutes_march.docx",
    newName: "team_minutes_march.docx",
    scores: [
      { name: "Meetings", score: 0.89 },
      { name: "Reports", score: 0.64 },
      { name: "Operations", score: 0.47 },
      { name: "Finance", score: 0.14 },
    ],
  },
  {
    id: "h-007",
    type: "organize",
    title: "product_brief_v2.pdf",
    subtitle: "No move and no rename",
    timestamp: "2026-02-26T17:05:00.000Z",
    fromPath: "C:/Users/supak/Documents/KLIN/Product/product_brief_v2.pdf",
    toPath: "C:/Users/supak/Documents/KLIN/Product/product_brief_v2.pdf",
    oldName: "product_brief_v2.pdf",
    newName: "product_brief_v2.pdf",
    scores: [
      { name: "Product", score: 0.78 },
      { name: "Reports", score: 0.53 },
      { name: "Marketing", score: 0.42 },
      { name: "Meetings", score: 0.19 },
    ],
  },
];

export default MOCK_HISTORY_ENTRIES;
