import { createServer } from "node:http";
const PORT = 3000;

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(JSON.stringify(payload));
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";

    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 2_000_000) {
        reject(new Error("Request body too large"));
      }
    });

    req.on("end", () => {
      try {
        const parsed = data ? JSON.parse(data) : {};
        resolve(parsed);
      } catch {
        reject(new Error("Invalid JSON body"));
      }
    });

    req.on("error", reject);
  });
}

const FIXED_RESPONSE_TEMPLATES = [
  {
    score: "Finance:0.91, Work:0.06, Personal:0.03",
    new_name: "Invoice-2026-02.pdf|Monthly-Invoice-Feb-2026.pdf|Finance-Invoice-February.pdf",
    summary: "Invoice for February 2026 services.",
    calendar: null,
  },
  {
    score: "Work:0.87, Personal:0.10, Finance:0.03",
    new_name: "Meeting-Notes-Project-Alpha.txt|Project-Alpha-Sprint-Notes.txt",
    summary: "Action items and project timeline updates from meeting.",
    calendar: null,
  },
];

const FIXED_HISTORY_RESPONSE = {
  items: [
    {
      id: "h1",
      type: "organize",
      title: "Invoice-2026-02.pdf",
      subtitle: "Moved to Finance",
      timestamp: new Date(Date.now() - 1_200_000).toISOString(),
      fromPath: "C:/Users/supak/Downloads/Invoice-2026-02.pdf",
      toPath: "C:/Users/supak/Documents/KLIN/Finance/Invoice-2026-02.pdf",
      oldName: "invoice_2026_02.pdf",
      newName: "Invoice-2026-02.pdf",
      scores: [
        { name: "Finance", score: 0.91 },
        { name: "Work", score: 0.06 },
        { name: "Personal", score: 0.03 },
      ],
    },
    {
      id: "h2",
      type: "summary",
      title: "Project-Alpha-Summary.md",
      subtitle: "Summary generated",
      timestamp: new Date(Date.now() - 4_800_000).toISOString(),
      fileNames: ["meeting-notes.txt", "action-items.txt", "timeline.txt"],
      summaryPath: "C:/Users/supak/Documents/KLIN/Summaries/Project-Alpha-Summary.md",
    },
    {
      id: "h3",
      type: "calendar",
      title: "Project Alpha Weekly Sync",
      subtitle: "Calendar event found in notes",
      timestamp: new Date(Date.now() - 7_200_000).toISOString(),
      foundInFile: true,
      sourceFileName: "meeting-notes.txt",
      meetingTitle: "Project Alpha Weekly Sync",
      meetingTime: "2026-03-02 10:00",
      meetingLocation: "Microsoft Teams",
      details: "Review sprint progress and pending blockers.",
      actionLabel: "Add to calendar",
    },
  ],
};

const FIXED_NOTE_SUMMARY_RESPONSE = {
  summary: "Meeting notes summary: Team reviewed sprint progress, identified two blockers, and agreed on next actions. Follow-up tasks include API integration validation, dashboard polish, and history flow QA.",
  suggestedFolders: [
    "C:/Users/supak/Documents/KLIN/Notes/Work",
    "C:/Users/supak/Documents/KLIN/Notes/Meetings",
    "C:/Users/supak/Documents/KLIN/Notes/Archive",
  ],
  titleSuggestion: "Sprint-Review-Notes",
};

const FIXED_CALENDAR_RESPONSE = {
  found: true,
  requestId: `calendar-${Date.now()}`,
  event: {
    title: "Project Alpha Weekly Sync",
    description: "Review sprint progress and pending blockers.",
    date: "2026-03-02",
    startTime: "10:00",
    endTime: "11:00",
    location: "Microsoft Teams",
    timeZone: "Asia/Bangkok",
    organizer: "supakorn.tungpa@gmail.com",
    attendees: ["pm@klin.app", "dev@klin.app"],
    meetLink: "https://teams.microsoft.com/l/meetup-join/mock-link",
    status: "confirmed",
    calendarId: "primary",
  },
};

let latestCalendarResponse = {
  found: false,
  requestId: null,
  event: null,
};

function normalizeCalendarEventPayload(payload) {
  const source = payload && typeof payload === "object" && payload.event && typeof payload.event === "object"
    ? payload.event
    : payload;

  const title = String(source?.title ?? "").trim();
  const description = String(source?.description ?? "").trim();
  const date = String(source?.date ?? "").trim();
  const startTime = String(source?.startTime ?? "").trim();
  const endTime = String(source?.endTime ?? "").trim();
  const location = String(source?.location ?? "").trim();

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
    timeZone: String(source?.timeZone ?? "").trim() || undefined,
    organizer: String(source?.organizer ?? "").trim() || undefined,
    attendees: Array.isArray(source?.attendees)
      ? source.attendees.map((item) => String(item)).filter(Boolean)
      : undefined,
    meetLink: String(source?.meetLink ?? "").trim() || undefined,
    status: String(source?.status ?? "").trim() || undefined,
    calendarId: String(source?.calendarId ?? "").trim() || undefined,
  };
}

function buildCalendarHistoryItem(event) {
  const meetingTime = `${event.date} ${event.startTime}`;

  return {
    id: `h-calendar-${Date.now()}`,
    type: "calendar",
    title: event.title,
    subtitle: "Calendar event received from API",
    timestamp: new Date().toISOString(),
    foundInFile: false,
    sourceFileName: "calendar-api",
    meetingTitle: event.title,
    meetingTime,
    meetingLocation: event.location,
    details: event.description || "",
    actionLabel: "Add to calendar",
    attendees: event.attendees,
    meetLink: event.meetLink,
    organizer: event.organizer,
    timeZone: event.timeZone,
    status: event.status,
    calendarId: event.calendarId,
  };
}

function normalizeRequest(payload) {
  const filePaths = Array.isArray(payload?.filePaths)
    ? payload.filePaths.map((item) => String(item)).filter(Boolean)
    : [];

  return { filePaths };
}

function handleAnalyze(payload) {
  const { filePaths } = normalizeRequest(payload);

  const reuslt = filePaths.map((filePath, index) => ({
    [filePath]: FIXED_RESPONSE_TEMPLATES[index % FIXED_RESPONSE_TEMPLATES.length],
  }));

  return { reuslt };
}

const server = createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    sendJson(res, 200, { ok: true });
    return;
  }

  const url = req.url ?? "/";
  const isAnalyzeRoute = req.method === "POST" && (url === "/organize" || url === "/organize/analyze");
  const isHistoryRoute = req.method === "GET" && (url === "/history" || url === "/history/list");
  const isNoteSummarizeRoute = req.method === "POST" && (url === "/notes/summarize" || url === "/note/summarize");
  const isCalendarGetRoute = req.method === "GET" && (url === "/calendar" || url === "/calendar/found");
  const isCalendarPostRoute = req.method === "POST" && (url === "/calendar" || url === "/calendar/found");

  if (isHistoryRoute) {
    sendJson(res, 200, FIXED_HISTORY_RESPONSE);
    return;
  }

  if (isNoteSummarizeRoute) {
    sendJson(res, 200, FIXED_NOTE_SUMMARY_RESPONSE);
    return;
  }

  if (isCalendarGetRoute) {
    sendJson(res, 200, latestCalendarResponse.found ? latestCalendarResponse : { ...FIXED_CALENDAR_RESPONSE, found: false, event: null });
    return;
  }

  if (isCalendarPostRoute) {
    try {
      const payload = await readJsonBody(req);
      const normalizedEvent = normalizeCalendarEventPayload(payload) ?? FIXED_CALENDAR_RESPONSE.event;
      const historyItem = buildCalendarHistoryItem(normalizedEvent);

      latestCalendarResponse = {
        found: true,
        requestId: `calendar-${Date.now()}`,
        event: normalizedEvent,
      };

      FIXED_HISTORY_RESPONSE.items.unshift(historyItem);

      sendJson(res, 200, {
        ok: true,
        requestId: latestCalendarResponse.requestId,
        found: true,
        event: latestCalendarResponse.event,
        historyItem,
      });
    } catch (error) {
      sendJson(res, 400, {
        error: "Bad Request",
        message: error instanceof Error ? error.message : "Invalid request",
      });
    }
    return;
  }

  if (!isAnalyzeRoute) {
    sendJson(res, 404, {
      error: "Not Found",
      message: "Use GET /history or /history/list, GET /calendar or /calendar/found, POST /calendar or /calendar/found, POST /organize, POST /organize/analyze, POST /notes/summarize",
    });
    return;
  }

  try {
    const payload = await readJsonBody(req);
    sendJson(res, 200, handleAnalyze(payload));
  } catch (error) {
    sendJson(res, 400, {
      error: "Bad Request",
      message: error instanceof Error ? error.message : "Invalid request",
    });
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`KLIN organize mock API running at http://localhost:${PORT}`);
  console.log("Endpoints: GET /history, GET /history/list, GET /calendar, GET /calendar/found, POST /calendar, POST /calendar/found, POST /organize, POST /organize/analyze, POST /notes/summarize");
});
