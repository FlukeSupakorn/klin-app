const NOTES_API_URL_CANDIDATES = [
  "http://127.0.0.1:8000/api/summary",
  "http://localhost:8000/api/summary",
];

const NOTE_HISTORY_API_URL_CANDIDATES = [
  "http://127.0.0.1:8000/api/history/note",
  "http://localhost:8000/api/history/note",
];

import { withLlama } from "@/hooks/useLlama";

export interface NotesSummarizeResult {
  summary: string;
  suggestedTitle: string;
  processingTimeMs?: number;
}

interface NotesStreamCallbacks {
  onChunk?: (delta: string) => void;
  onMeta?: (meta: { suggestedTitle?: string }) => void;
  signal?: AbortSignal;
}

export interface NoteHistoryPayload {
  fileName: string;
  destinationPath: string;
  sourceFiles?: string[];
  categoryName?: string;
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
    const fallbackTitle = buildSuggestedTitleFromPaths(filePaths);
    return withLlama(async () => {
      let lastError: unknown = null;

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
    });
  },

  async summarizeFromFilesStream(
    filePaths: string[],
    callbacks: NotesStreamCallbacks = {},
  ): Promise<NotesSummarizeResult> {
    const fallbackTitle = buildSuggestedTitleFromPaths(filePaths);
    return withLlama(async () => {
      let lastError: unknown = null;

      for (const baseUrl of NOTES_API_URL_CANDIDATES) {
        const url = `${baseUrl}/stream`;

        try {
          const response = await fetch(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Accept: "text/event-stream",
            },
            body: JSON.stringify({ file_paths: filePaths }),
            signal: callbacks.signal,
          });

          if (!response.ok || !response.body) {
            lastError = new Error(`Notes API stream error: ${response.status} at ${url}`);
            continue;
          }

          const decoder = new TextDecoder();
          const reader = response.body.getReader();

          let suggestedTitle = fallbackTitle;
          let processingTimeMs: number | undefined;
          let summary = "";
          let buffer = "";

          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              break;
            }

            buffer += decoder.decode(value, { stream: true });
            const events = buffer.split("\n\n");
            buffer = events.pop() ?? "";

            for (const rawEvent of events) {
              const lines = rawEvent.split("\n");
              let eventName = "message";
              const dataLines: string[] = [];

              for (const line of lines) {
                if (line.startsWith("event:")) {
                  eventName = line.slice(6).trim();
                } else if (line.startsWith("data:")) {
                  dataLines.push(line.slice(5).trim());
                }
              }

              const dataRaw = dataLines.join("\n");
              if (!dataRaw) {
                continue;
              }

              let payload: unknown = dataRaw;
              try {
                payload = JSON.parse(dataRaw);
              } catch {
                payload = dataRaw;
              }

              if (eventName === "meta" && typeof payload === "object" && payload) {
                const meta = payload as { suggested_title?: unknown };
                if (typeof meta.suggested_title === "string" && meta.suggested_title.trim().length > 0) {
                  suggestedTitle = meta.suggested_title.trim();
                }
                callbacks.onMeta?.({ suggestedTitle });
              }

              if (eventName === "chunk") {
                let delta = "";
                if (typeof payload === "string") {
                  delta = payload;
                } else if (typeof payload === "object" && payload) {
                  const data = payload as { delta?: unknown };
                  delta = typeof data.delta === "string" ? data.delta : "";
                }

                if (delta) {
                  summary += delta;
                  callbacks.onChunk?.(delta);
                }
              }

              if (eventName === "done" && typeof payload === "object" && payload) {
                const doneData = payload as { processing_time_ms?: unknown; suggested_title?: unknown };
                const processingRaw = doneData.processing_time_ms;
                processingTimeMs = Number.isFinite(Number(processingRaw)) ? Number(processingRaw) : processingTimeMs;

                if (typeof doneData.suggested_title === "string" && doneData.suggested_title.trim().length > 0) {
                  suggestedTitle = doneData.suggested_title.trim();
                }
              }
            }
          }

          return {
            summary,
            suggestedTitle,
            processingTimeMs,
          };
        } catch (error) {
          if (error instanceof DOMException && error.name === "AbortError") {
            throw error;
          }
          lastError = error;
        }
      }

      // Fallback to existing non-stream call if stream endpoint is unavailable.
      try {
        return await notesApiService.summarizeFromFiles(filePaths);
      } catch {
        throw lastError ?? new Error("Notes API stream unavailable");
      }
    });
  },

  async logNoteHistory(payload: NoteHistoryPayload): Promise<void> {
    let lastError: unknown = null;

    for (const url of NOTE_HISTORY_API_URL_CANDIDATES) {
      try {
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            file_name: payload.fileName,
            destination_path: payload.destinationPath,
            source_files: payload.sourceFiles ?? [],
            category_name: payload.categoryName ?? null,
          }),
        });

        if (!response.ok) {
          lastError = new Error(`Note history API error: ${response.status} at ${url}`);
          continue;
        }

        return;
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError ?? new Error("Note history API unavailable");
  },
};
