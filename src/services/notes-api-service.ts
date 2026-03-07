const NOTES_API_URL_CANDIDATES = [
  "http://127.0.0.1:8000/api/notes/summarize",
  "http://localhost:8000/api/notes/summarize",
  "http://localhost:3000/notes/summarize",
  "http://localhost:3000/note/summarize",
];

export interface NotesSummarizeResult {
  summary: string;
  suggestedTitle: string;
  processingTimeMs?: number;
}

function normalizeResponse(payload: unknown): NotesSummarizeResult {
  if (!payload || typeof payload !== "object") {
    return {
      summary: "",
      suggestedTitle: "Quick-Note",
    };
  }

  const data = payload as {
    summary?: unknown;
    suggested_title?: unknown;
    suggestedTitle?: unknown;
    titleSuggestion?: unknown;
    processing_time_ms?: unknown;
    processingTimeMs?: unknown;
  };

  const summary = typeof data.summary === "string" ? data.summary : "";
  const suggestedTitleRaw =
    data.suggestedTitle ?? data.suggested_title ?? data.titleSuggestion;
  const suggestedTitle = typeof suggestedTitleRaw === "string" && suggestedTitleRaw.trim().length > 0
    ? suggestedTitleRaw.trim()
    : "Quick-Note";
  const processingRaw = data.processingTimeMs ?? data.processing_time_ms;
  const processingTimeMs = Number.isFinite(Number(processingRaw)) ? Number(processingRaw) : undefined;

  return {
    summary,
    suggestedTitle,
    processingTimeMs,
  };
}

export const notesApiService = {
  async summarizeFromFiles(filePaths: string[]): Promise<NotesSummarizeResult> {
    let lastError: unknown = null;

    for (const url of NOTES_API_URL_CANDIDATES) {
      try {
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ filePaths }),
        });

        if (!response.ok) {
          lastError = new Error(`Notes API error: ${response.status} at ${url}`);
          continue;
        }

        const payload = await response.json();
        return normalizeResponse(payload);
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError ?? new Error("Notes API unavailable");
  },
};
