import type {
  FileSearchRequest,
  FileSearchResponse,
  FileSearchResultItem,
  SemanticStatus,
} from "@/types/domain";

const SEARCH_API_URL_CANDIDATES = [
  "http://127.0.0.1:8000/api/search/files",
  "http://localhost:8000/api/search/files",
];

const VALID_STATUSES: SemanticStatus[] = ["ready", "pending", "degraded", "not_ready"];

function asString(input: unknown): string {
  return typeof input === "string" ? input : "";
}

function asNumber(input: unknown): number {
  const value = typeof input === "number" ? input : Number(input);
  return Number.isFinite(value) ? value : 0;
}

function asSemanticStatus(input: unknown): SemanticStatus {
  if (typeof input === "string" && (VALID_STATUSES as string[]).includes(input)) {
    return input as SemanticStatus;
  }
  return "ready";
}

function normalizeResults(rows: unknown): FileSearchResultItem[] {
  const list = Array.isArray(rows) ? rows : [];
  return list
    .map((item, index) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;

      const id = asString(row.id) || `search-${index + 1}`;
      const fileName = asString(row.fileName) || asString(row.file_name);
      const fileType = asString(row.fileType) || asString(row.file_type);
      const sizeBytes = asNumber(row.sizeBytes ?? row.size_bytes);
      const folder = asString(row.folder);
      const lastEdited = asString(row.lastEdited) || asString(row.last_edited);
      const path = asString(row.path);

      if (!fileName || !path) return null;

      return {
        id,
        fileName,
        fileType,
        sizeBytes,
        folder,
        lastEdited,
        path,
      } satisfies FileSearchResultItem;
    })
    .filter((row): row is FileSearchResultItem => row !== null);
}

function normalizeResponse(payload: unknown): FileSearchResponse {
  const root = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};

  const semanticStatus = asSemanticStatus(root.semanticStatus ?? root.semantic_status);
  const rawError = root.semanticError ?? root.semantic_error;
  const semanticError = typeof rawError === "string" && rawError.length > 0 ? rawError : null;
  const indexingPendingCount = asNumber(root.indexingPendingCount ?? root.indexing_pending_count);

  return {
    results: normalizeResults(root.results),
    semanticStatus,
    semanticError,
    indexingPendingCount,
  };
}

async function postSearch(
  url: string,
  payload: FileSearchRequest,
  signal?: AbortSignal,
): Promise<FileSearchResponse> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal,
  });

  if (!response.ok) {
    throw new Error(`Search API error: ${response.status} at ${url}`);
  }

  return normalizeResponse(await response.json());
}

export const fileSearchApiService = {
  async search(query: string, signal?: AbortSignal): Promise<FileSearchResponse> {
    const payload: FileSearchRequest = { query };

    let lastError: unknown = null;
    for (const url of SEARCH_API_URL_CANDIDATES) {
      try {
        return await postSearch(url, payload, signal);
      } catch (error) {
        if ((error as { name?: string })?.name === "AbortError") throw error;
        lastError = error;
      }
    }

    throw lastError ?? new Error("Search API unavailable");
  },
};
