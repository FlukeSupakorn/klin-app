const NOTES_API_URL_CANDIDATES = [
  "http://localhost:3000/notes/summarize",
  "http://localhost:3000/note/summarize",
];

export interface NotesSummarizeResult {
  summary: string;
  suggestedFolders: string[];
  titleSuggestion: string;
}

function normalizeResponse(payload: unknown): NotesSummarizeResult {
  if (!payload || typeof payload !== "object") {
    return {
      summary: "",
      suggestedFolders: [],
      titleSuggestion: "Quick-Note",
    };
  }

  const data = payload as {
    summary?: unknown;
    suggestedFolders?: unknown;
    titleSuggestion?: unknown;
  };

  const summary = typeof data.summary === "string" ? data.summary : "";
  const suggestedFolders = Array.isArray(data.suggestedFolders)
    ? data.suggestedFolders.map((item) => String(item)).filter(Boolean)
    : [];
  const titleSuggestion = typeof data.titleSuggestion === "string" && data.titleSuggestion.trim().length > 0
    ? data.titleSuggestion.trim()
    : "Quick-Note";

  return {
    summary,
    suggestedFolders,
    titleSuggestion,
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
