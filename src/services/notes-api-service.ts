const NOTES_API_URL_CANDIDATES = [
  "http://127.0.0.1:8000/api/summary",
  "http://localhost:8000/api/summary",
];

export interface NotesSummarizeResult {
  summary: string;
  suggestedTitle: string;
  processingTimeMs?: number;
}

function buildSuggestedTitleFromPaths(filePaths: string[]): string {
  if (filePaths.length > 1) {
    return `Summary - ${filePaths.length} files`;
  }

  const first = filePaths[0];
  if (!first) {
    return "Quick-Note";
  }

  const base = first.split(/[\\/]/).pop()?.replace(/\.[^.]+$/, "")?.trim();
  return base && base.length > 0 ? base : "Quick-Note";
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
    const fallbackTitle = buildSuggestedTitleFromPaths(filePaths);

    for (const url of NOTES_API_URL_CANDIDATES) {
      try {
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ file_paths: filePaths }),
        });

        if (!response.ok) {
          lastError = new Error(`Notes API error: ${response.status} at ${url}`);
          continue;
        }

        const payload = await response.json();
        const normalized = normalizeResponse(payload);

        return {
          ...normalized,
          suggestedTitle: normalized.suggestedTitle === "Quick-Note" ? fallbackTitle : normalized.suggestedTitle,
        };
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError ?? new Error("Notes API unavailable");
  },
};
