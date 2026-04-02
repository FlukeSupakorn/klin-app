import type {
  CategoryScore,
  ManagedCategory,
  OrganizeAnalyzeFileResult,
  OrganizeAnalyzeRequest,
  OrganizePreviewItem,
} from "@/types/domain";
import { withLlama } from "@/hooks/useLlama";

const ORGANIZE_API_URL_CANDIDATES = [
  "http://127.0.0.1:8000/api/organize",
  "http://localhost:8000/api/organize",
];

function isAbortError(error: unknown): boolean {
  if (error instanceof DOMException && error.name === "AbortError") {
    return true;
  }

  if (error && typeof error === "object" && "name" in error) {
    return (error as { name?: string }).name === "AbortError";
  }

  if (error instanceof Error) {
    return /abort/i.test(error.message);
  }

  return false;
}

function normalizeCategoryLabel(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function findMatchingManagedCategoryName(rawName: string, categoryCatalog: ManagedCategory[]): string | null {
  const normalizedRaw = normalizeCategoryLabel(rawName);
  if (!normalizedRaw) {
    return null;
  }

  const exact = categoryCatalog.find((category) => normalizeCategoryLabel(category.name) === normalizedRaw);
  if (exact) {
    return exact.name;
  }

  const contains = categoryCatalog.find((category) => {
    const normalizedCategory = normalizeCategoryLabel(category.name);
    return normalizedCategory.includes(normalizedRaw) || normalizedRaw.includes(normalizedCategory);
  });

  if (contains) {
    return contains.name;
  }

  const firstToken = normalizedRaw.split(" ")[0] ?? "";
  if (!firstToken) {
    return null;
  }

  const tokenMatch = categoryCatalog.find((category) => normalizeCategoryLabel(category.name).includes(firstToken));
  return tokenMatch?.name ?? null;
}

function alignScoresToManagedCategories(scores: CategoryScore[], categoryCatalog: ManagedCategory[]): CategoryScore[] {
  const merged = new Map<string, number>();

  scores.forEach((score) => {
    const matchedName = findMatchingManagedCategoryName(score.name, categoryCatalog) ?? score.name;
    const previous = merged.get(matchedName) ?? 0;
    merged.set(matchedName, Math.max(previous, score.score));
  });

  return [...merged.entries()]
    .map(([name, score]) => ({ name, score }))
    .sort((a, b) => b.score - a.score);
}

function normalizeScore(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }

  if (value > 1) {
    return Number((value / 100).toFixed(4));
  }

  return Number(value.toFixed(4));
}

function parseScoreEntries(fileResult: OrganizeAnalyzeFileResult | undefined): CategoryScore[] {
  if (!fileResult) {
    return [];
  }

  return fileResult.categories
    .map((entry) => ({
      categoryId: entry.category_id,
      name: entry.name,
      score: normalizeScore(entry.score),
    }))
    .filter((entry) => entry.name.length > 0)
    .sort((a, b) => b.score - a.score);
}

function parseSuggestedNames(rawName: unknown): string[] {
  if (Array.isArray(rawName)) {
    return rawName.map((entry) => String(entry).trim()).filter(Boolean);
  }

  if (typeof rawName === "string") {
    const direct = rawName.trim();
    if (!direct) {
      return [];
    }

    if (direct.includes("|")) {
      return direct.split("|").map((entry) => entry.trim()).filter(Boolean);
    }

    if (direct.includes(",")) {
      return direct.split(",").map((entry) => entry.trim()).filter(Boolean);
    }

    return [direct];
  }

  return [];
}

function parseWorkerSuggestedNames(fileResult: OrganizeAnalyzeFileResult | undefined): string[] {
  if (!fileResult) {
    return [];
  }

  // Keep compatibility with older payloads while preferring v3 `suggested_names`.
  const analysis = fileResult.analysis as {
    suggested_names?: unknown;
    suggested_name?: unknown;
  };

  if (Array.isArray(analysis.suggested_names)) {
    return analysis.suggested_names.map((entry) => String(entry).trim()).filter(Boolean);
  }

  return parseSuggestedNames(analysis.suggested_name);
}

function buildRequest(paths: string[]): OrganizeAnalyzeRequest {
  return {
    file_paths: paths,
  };
}

function normalizeResults(payload: unknown): Map<string, OrganizeAnalyzeFileResult> {
  if (!payload || typeof payload !== "object") {
    return new Map();
  }

  const root = payload as { results?: unknown };
  if (!root.results || typeof root.results !== "object" || Array.isArray(root.results)) {
    return new Map();
  }

  const resultMap = new Map<string, OrganizeAnalyzeFileResult>();
  Object.entries(root.results as Record<string, unknown>).forEach(([filePath, value]) => {
    if (value && typeof value === "object") {
      resultMap.set(filePath, value as OrganizeAnalyzeFileResult);
    }
  });

  return resultMap;
}

async function postAnalyze(requestPayload: OrganizeAnalyzeRequest, signal?: AbortSignal): Promise<unknown> {
  if (signal?.aborted) {
    throw new DOMException("Request aborted", "AbortError");
  }

  return withLlama(['chat', 'embed'], async () => {
    let lastError: unknown = null;

    for (const url of ORGANIZE_API_URL_CANDIDATES) {
      try {
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestPayload),
          signal,
        });

        if (!response.ok) {
          if (signal?.aborted) {
            throw new DOMException("Request aborted", "AbortError");
          }
          lastError = new Error(`Organize API error: ${response.status} at ${url}`);
          continue;
        }

        return await response.json();
      } catch (error) {
        if (signal?.aborted || isAbortError(error)) {
          throw error;
        }

        lastError = error;
      }
    }

    throw lastError ?? new Error("Organize API unavailable");
  });
}

function buildFallbackScores(categoryCatalog: ManagedCategory[]): CategoryScore[] {
  const firstEnabled = categoryCatalog.find((category) => category.enabled);
  return firstEnabled ? [{ name: firstEnabled.name, score: 1 }] : [{ name: "Uncategorized", score: 1 }];
}

export const organizeApiService = {
  async analyze(paths: string[], categoryCatalog: ManagedCategory[], signal?: AbortSignal): Promise<OrganizePreviewItem[]> {
    if (paths.length === 0) {
      return [];
    }

    const requestPayload = buildRequest(paths);
    const payload = await postAnalyze(requestPayload, signal);
    const resultMap = normalizeResults(payload);

    const categoryPathMap = new Map(categoryCatalog.map((category) => [category.name, category.folderPath]));

    return paths.map((path, index) => {
      const fileName = path.split(/[\\/]/).pop() ?? `file-${index + 1}`;
      const fileResult = resultMap.get(path);
      const topScores = parseScoreEntries(fileResult);
      const alignedScores = alignScoresToManagedCategories(topScores, categoryCatalog);
      const fallbackScores = alignedScores.length > 0 ? alignedScores : buildFallbackScores(categoryCatalog);
      const selectedCategory = fallbackScores[0]?.name ?? "Uncategorized";
      const destinationFolder =
        categoryPathMap.get(selectedCategory) ?? categoryCatalog[0]?.folderPath ?? "";
      const suggestedNames = parseWorkerSuggestedNames(fileResult);

      return {
        id: crypto.randomUUID(),
        workerFileId: fileResult?.file_id ?? null,
        fileName,
        currentPath: path,
        suggestedNames,
        suggestedName: null,
        selectedCategory,
        // Keep original filename unless user explicitly applies a suggested name in the UI.
        destinationPath: destinationFolder ? `${destinationFolder}/${fileName}` : fileName,
        confidence: fallbackScores[0]?.score ?? 0,
        topScores: fallbackScores,
        summary: fileResult?.analysis?.summary ?? fileResult?.error ?? null,
        calendar: null,
        analysisStatus: fileResult?.error ? "failed" : "completed",
        analysisError: fileResult?.error ?? null,
        moveStatus: "idle",
        lastMovedFromPath: null,
        lastMovedToPath: null,
      };
    });
  },

  async analyzeOne(path: string, categoryCatalog: ManagedCategory[], signal?: AbortSignal): Promise<OrganizePreviewItem> {
    const [item] = await this.analyze([path], categoryCatalog, signal);
    if (item) {
      return item;
    }

    const fileName = path.split(/[\\/]/).pop() ?? "unknown-file";
    return {
      id: crypto.randomUUID(),
      workerFileId: null,
      fileName,
      currentPath: path,
      suggestedNames: [],
      suggestedName: null,
      selectedCategory: "Uncategorized",
      destinationPath: fileName,
      confidence: 0,
      topScores: [{ name: "Uncategorized", score: 0 }],
      summary: null,
      calendar: null,
      analysisStatus: "failed",
      analysisError: "No analysis result returned by worker.",
      moveStatus: "idle",
      lastMovedFromPath: null,
      lastMovedToPath: null,
    };
  },

  async applyDecision(input: {
    fileId: string;
    selectedName: string | null;
    selectedCategory: { id: string; name: string; score: number } | null;
  }): Promise<void> {
    const urlCandidates = [
      "http://127.0.0.1:8000/api/organize/apply",
      "http://localhost:8000/api/organize/apply",
    ];

    const payload = {
      file_id: input.fileId,
      selected_name: input.selectedName,
      selected_category: input.selectedCategory
        ? {
          id: input.selectedCategory.id,
          name: input.selectedCategory.name,
          score: input.selectedCategory.score,
        }
        : null,
    };

    let lastError: unknown = null;

    for (const url of urlCandidates) {
      try {
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          lastError = new Error(`Organize apply API error: ${response.status} at ${url}`);
          continue;
        }

        return;
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError ?? new Error("Organize apply API unavailable");
  },
};
