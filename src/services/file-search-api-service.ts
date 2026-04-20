import type { FileSearchRequest, FileSearchResponse, FileSearchResultItem } from "@/types/domain";

const SEARCH_API_URL_CANDIDATES = [
  "http://127.0.0.1:8000/api/search/files",
  "http://localhost:8000/api/search/files",
];

function asString(input: unknown): string {
  return typeof input === "string" ? input : "";
}

function asNumber(input: unknown): number {
  const value = typeof input === "number" ? input : Number(input);
  return Number.isFinite(value) ? value : 0;
}

function normalizeResults(payload: unknown): FileSearchResultItem[] {
  const root = payload && typeof payload === "object" ? (payload as { results?: unknown }) : null;
  const rows = Array.isArray(root?.results) ? root.results : [];

  return rows
    .map((item, index) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const row = item as Record<string, unknown>;

      const id = asString(row.id) || `search-${index + 1}`;
      const fileName = asString(row.fileName) || asString(row.file_name);
      const fileType = asString(row.fileType) || asString(row.file_type);
      const sizeBytes = asNumber(row.sizeBytes ?? row.size_bytes);
      const folder = asString(row.folder);
      const lastEdited = asString(row.lastEdited) || asString(row.last_edited);
      const path = asString(row.path);

      if (!fileName || !path) {
        return null;
      }

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

async function postSearch(url: string, payload: FileSearchRequest): Promise<FileSearchResultItem[]> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Search API error: ${response.status} at ${url}`);
  }

  const data = (await response.json()) as FileSearchResponse;
  return normalizeResults(data);
}

export const fileSearchApiService = {
  async search(query: string): Promise<FileSearchResultItem[]> {
    const payload: FileSearchRequest = {
      query,
    };

    let lastError: unknown = null;

    for (const url of SEARCH_API_URL_CANDIDATES) {
      try {
        return await postSearch(url, payload);
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError ?? new Error("Search API unavailable");
  },
};
