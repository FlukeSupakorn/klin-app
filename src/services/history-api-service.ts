import type { HistoryEntry } from "@/types/history";
import { getPathTail } from "@/lib/path-utils";
import { parseNormalizedScores, normalizeScore } from "@/lib/scoring-utils";

const HISTORY_API_URL_CANDIDATES = [
  "http://127.0.0.1:8000/api/history",
  "http://localhost:8000/api/history",
];

export interface HistoryListParams {
  limit?: number;
  offset?: number;
  search?: string;
}

export interface HistoryListPage {
  entries: HistoryEntry[];
  limit: number;
  offset: number;
  hasMore: boolean;
}

function normalizeEntries(payload: unknown): HistoryEntry[] {
  const rawEntries = (() => {
    if (Array.isArray(payload)) {
      return payload;
    }

    if (payload && typeof payload === "object") {
      const root = payload as { items?: unknown; result?: unknown; history?: unknown; results?: unknown };
      if (Array.isArray(root.results)) {
        return root.results;
      }
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
    .map((entry, index): HistoryEntry | null => {
      if (!entry || typeof entry !== "object") {
        return null;
      }

      const id = "id" in entry ? String(entry.id ?? "") : `history-${index + 1}`;
      const action = "action" in entry ? String(entry.action ?? "") : "";
      const inferredType = ["organized", "organized_cached", "organized_reclassified", "moved", "renamed", "renamed_moved"].includes(action)
        ? "organize"
        : action === "note"
          ? "summary"
        : "";
      const type = "type" in entry ? String(entry.type ?? inferredType) : inferredType;
      const timestamp =
        "timestamp" in entry
          ? String(entry.timestamp ?? new Date().toISOString())
          : "created_at" in entry
            ? String(entry.created_at ?? new Date().toISOString())
            : new Date().toISOString();

      const backendCategory = "current_category" in entry ? String(entry.current_category ?? "") : "";
      const backendSelectedCategory = "category" in entry && entry.category && typeof entry.category === "object"
        ? String((entry.category as { name?: unknown }).name ?? "")
        : "";
      const title =
        "title" in entry
          ? String(entry.title ?? "")
          : "file_name" in entry
            ? String(entry.file_name ?? "")
          : "original_path" in entry
            ? getPathTail(String(entry.original_path ?? ""))
            : "Organized file";
      const subtitle =
        "subtitle" in entry
          ? String(entry.subtitle ?? "")
          : action === "note"
            ? "Note saved"
          : action === "renamed_moved"
            ? "Renamed and moved"
          : action === "renamed"
            ? "Renamed"
          : action === "moved"
            ? "Moved"
          : backendSelectedCategory
            ? `Organized to ${backendSelectedCategory}`
          : backendCategory
            ? `Organized to ${backendCategory}`
            : "Organized";

      if (!title || !subtitle || !timestamp) {
        return null;
      }

      if (type === "organize") {
        const backendOriginalPath = "original_path" in entry ? String(entry.original_path ?? "") : "";
        const backendMovedPath = "moved_path" in entry
          ? String(entry.moved_path ?? "")
          : "new_path" in entry
            ? String(entry.new_path ?? "")
            : "";
        const defaultToPath = backendMovedPath || backendOriginalPath;
        const fromPath = "fromPath" in entry ? String(entry.fromPath ?? backendOriginalPath) : backendOriginalPath;
        const toPath = "toPath" in entry
          ? String((entry.toPath ?? backendMovedPath) || backendOriginalPath)
          : defaultToPath;
        const oldName = "oldName" in entry ? String(entry.oldName ?? getPathTail(fromPath)) : getPathTail(fromPath);
        const newName = "newName" in entry ? String(entry.newName ?? getPathTail(toPath)) : getPathTail(toPath);
        let scores = parseNormalizedScores("scores" in entry ? entry.scores : "categories" in entry ? entry.categories : []);
        if (scores.length === 0 && "category" in entry && entry.category && typeof entry.category === "object") {
          const rawCategory = entry.category as { id?: unknown; name?: unknown; score?: unknown };
          const name = typeof rawCategory.name === "string" ? rawCategory.name : "";
          if (name) {
            const rawScore = typeof rawCategory.score === "number"
              ? rawCategory.score
              : typeof rawCategory.score === "string"
                ? Number(rawCategory.score)
                : 0;
            const normalized = normalizeScore(rawScore);
            scores = [{ categoryId: typeof rawCategory.id === "string" ? rawCategory.id : undefined, name, score: normalized }];
          }
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
        const summaryPath = "summaryPath" in entry
          ? String(entry.summaryPath ?? "")
          : "new_path" in entry
            ? String(entry.new_path ?? "")
            : "destination_path" in entry
              ? String(entry.destination_path ?? "")
              : "";
        const fileNames = "fileNames" in entry && Array.isArray(entry.fileNames)
          ? entry.fileNames.map((item: unknown) => String(item)).filter(Boolean)
          : "source_files" in entry && Array.isArray(entry.source_files)
            ? entry.source_files.map((item: unknown) => String(item)).filter(Boolean)
            : "file_name" in entry && String(entry.file_name ?? "").trim().length > 0
              ? [String(entry.file_name)]
          : [];
        const categoryName = "category_name" in entry ? String(entry.category_name ?? "") : "";
        const noteSubtitle = fileNames.length === 0
          ? (categoryName ? `Saved to ${categoryName}` : "Note saved")
          : fileNames.length === 1
            ? `Source: ${fileNames[0]}`
            : `Sources: ${fileNames[0]} +${fileNames.length - 1} more`;

        if (!summaryPath) {
          return null;
        }

        return {
          id,
          type: "summary",
          title,
          subtitle: action === "note"
            ? noteSubtitle
            : subtitle,
          timestamp,
          summaryPath,
          fileNames,
          categoryName: categoryName || undefined,
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
        const attendees = "attendees" in entry && Array.isArray(entry.attendees)
          ? entry.attendees.map((item: unknown) => String(item)).filter(Boolean)
          : undefined;
        const meetLink = "meetLink" in entry ? String(entry.meetLink ?? "") || undefined : undefined;
        const organizer = "organizer" in entry ? String(entry.organizer ?? "") || undefined : undefined;
        const timeZone = "timeZone" in entry ? String(entry.timeZone ?? "") || undefined : undefined;
        const status = "status" in entry ? String(entry.status ?? "") || undefined : undefined;
        const calendarId = "calendarId" in entry ? String(entry.calendarId ?? "") || undefined : undefined;

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
          attendees,
          meetLink,
          organizer,
          timeZone,
          status,
          calendarId,
        } satisfies HistoryEntry;
      }

      return null;
    })
    .filter((entry): entry is HistoryEntry => entry !== null) as HistoryEntry[];
}

async function fetchHistoryFrom(url: string, params: HistoryListParams): Promise<HistoryListPage> {
  const query = new URLSearchParams();
  if (typeof params.limit === "number") {
    query.set("limit", String(params.limit));
  }
  if (typeof params.offset === "number") {
    query.set("offset", String(params.offset));
  }
  if (params.search && params.search.trim().length > 0) {
    query.set("search", params.search.trim());
  }

  const queryString = query.toString();
  const requestUrl = queryString ? `${url}?${queryString}` : url;

  const response = await fetch(requestUrl, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`History API error: ${response.status} at ${url}`);
  }

  const payload = await response.json();
  const root = payload && typeof payload === "object" ? payload as { limit?: unknown; offset?: unknown; has_more?: unknown } : {};

  return {
    entries: normalizeEntries(payload),
    limit: typeof root.limit === "number" ? root.limit : params.limit ?? 20,
    offset: typeof root.offset === "number" ? root.offset : params.offset ?? 0,
    hasMore: Boolean(root.has_more),
  };
}

export const historyApiService = {
  async list(params: HistoryListParams = {}): Promise<HistoryListPage> {
    let lastError: unknown = null;

    for (const url of HISTORY_API_URL_CANDIDATES) {
      try {
        return await fetchHistoryFrom(url, params);
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError ?? new Error("History API unavailable");
  },
};
