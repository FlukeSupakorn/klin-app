import type { HistoryEntry, HistoryScore } from "@/features/history/history-types";

const HISTORY_API_URL_CANDIDATES = [
  "http://localhost:3000/history",
  "http://localhost:3000/history/list",
];

function normalizeScore(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }

  if (value > 1) {
    return Number((value / 100).toFixed(4));
  }

  return Number(value.toFixed(4));
}

function normalizeScores(input: unknown): HistoryScore[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const name = "name" in item ? String(item.name ?? "") : "";
      const score = "score" in item ? Number(item.score) : Number.NaN;
      if (!name) {
        return null;
      }

      return { name, score: normalizeScore(score) };
    })
    .filter((item): item is HistoryScore => item !== null)
    .sort((a, b) => b.score - a.score);
}

function normalizeEntries(payload: unknown): HistoryEntry[] {
  const rawEntries = (() => {
    if (Array.isArray(payload)) {
      return payload;
    }

    if (payload && typeof payload === "object") {
      const root = payload as { items?: unknown; result?: unknown; history?: unknown };
      if (Array.isArray(root.items)) {
        return root.items;
      }
      if (Array.isArray(root.result)) {
        return root.result;
      }
      if (Array.isArray(root.history)) {
        return root.history;
      }
    }

    return [];
  })();

  return rawEntries
    .map((entry, index) => {
      if (!entry || typeof entry !== "object") {
        return null;
      }

      const id = "id" in entry ? String(entry.id ?? "") : `history-${index + 1}`;
      const type = "type" in entry ? String(entry.type ?? "") : "";
      const title = "title" in entry ? String(entry.title ?? "") : "";
      const subtitle = "subtitle" in entry ? String(entry.subtitle ?? "") : "";
      const timestamp = "timestamp" in entry ? String(entry.timestamp ?? new Date().toISOString()) : new Date().toISOString();

      if (!title || !subtitle || !timestamp) {
        return null;
      }

      if (type === "organize") {
        const fromPath = "fromPath" in entry ? String(entry.fromPath ?? "") : "";
        const toPath = "toPath" in entry ? String(entry.toPath ?? "") : "";
        const oldName = "oldName" in entry ? String(entry.oldName ?? "") : "";
        const newName = "newName" in entry ? String(entry.newName ?? "") : "";
        const scores = normalizeScores("scores" in entry ? entry.scores : []);

        if (!fromPath || !toPath || !oldName || !newName) {
          return null;
        }

        return {
          id,
          type: "organize",
          title,
          subtitle,
          timestamp,
          fromPath,
          toPath,
          oldName,
          newName,
          scores,
        } satisfies HistoryEntry;
      }

      if (type === "summary") {
        const summaryPath = "summaryPath" in entry ? String(entry.summaryPath ?? "") : "";
        const fileNames = "fileNames" in entry && Array.isArray(entry.fileNames)
          ? entry.fileNames.map((item: unknown) => String(item)).filter(Boolean)
          : [];

        if (!summaryPath) {
          return null;
        }

        return {
          id,
          type: "summary",
          title,
          subtitle,
          timestamp,
          summaryPath,
          fileNames,
        } satisfies HistoryEntry;
      }

      if (type === "calendar") {
        const foundInFile = "foundInFile" in entry ? Boolean(entry.foundInFile) : false;
        const sourceFileName = "sourceFileName" in entry ? String(entry.sourceFileName ?? "") : "";
        const meetingTitle = "meetingTitle" in entry ? String(entry.meetingTitle ?? "") : "";
        const meetingTime = "meetingTime" in entry ? String(entry.meetingTime ?? "") : "";
        const meetingLocation = "meetingLocation" in entry ? String(entry.meetingLocation ?? "") : "";
        const details = "details" in entry ? String(entry.details ?? "") : "";
        const actionLabel = "actionLabel" in entry ? String(entry.actionLabel ?? "") : "";

        return {
          id,
          type: "calendar",
          title,
          subtitle,
          timestamp,
          foundInFile,
          sourceFileName,
          meetingTitle,
          meetingTime,
          meetingLocation,
          details,
          actionLabel,
        } satisfies HistoryEntry;
      }

      return null;
    })
    .filter((entry): entry is HistoryEntry => entry !== null);
}

async function fetchHistoryFrom(url: string): Promise<HistoryEntry[]> {
  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`History API error: ${response.status} at ${url}`);
  }

  const payload = await response.json();
  return normalizeEntries(payload);
}

export const historyApiService = {
  async list(): Promise<HistoryEntry[]> {
    let lastError: unknown = null;

    for (const url of HISTORY_API_URL_CANDIDATES) {
      try {
        return await fetchHistoryFrom(url);
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError ?? new Error("History API unavailable");
  },
};
