import type {
  CategoryScore,
  ManagedCategory,
  OrganizeAnalyzeFileResult,
  OrganizeAnalyzeRequest,
  OrganizePreviewItem,
} from "@/types/domain";

const ORGANIZE_API_URL_CANDIDATES = [
  "http://127.0.0.1:8000/api/organize",
  "http://localhost:8000/api/organize",
];

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

async function postAnalyze(requestPayload: OrganizeAnalyzeRequest): Promise<unknown> {
  let lastError: unknown = null;

  for (const url of ORGANIZE_API_URL_CANDIDATES) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestPayload),
      });

      if (!response.ok) {
        lastError = new Error(`Organize API error: ${response.status} at ${url}`);
        continue;
      }

      return await response.json();
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError ?? new Error("Organize API unavailable");
}

function buildFallbackScores(categoryCatalog: ManagedCategory[]): CategoryScore[] {
  const firstEnabled = categoryCatalog.find((category) => category.enabled);
  return firstEnabled ? [{ name: firstEnabled.name, score: 1 }] : [{ name: "Uncategorized", score: 1 }];
}

export const organizeApiService = {
  async analyze(paths: string[], categoryCatalog: ManagedCategory[]): Promise<OrganizePreviewItem[]> {
    if (paths.length === 0) {
      return [];
    }

    const requestPayload = buildRequest(paths);
    const payload = await postAnalyze(requestPayload);
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
      const effectiveName = suggestedNames[0] ?? fileName;

      return {
        id: crypto.randomUUID(),
        fileName,
        currentPath: path,
        suggestedNames,
        suggestedName: null,
        selectedCategory,
        destinationPath: destinationFolder ? `${destinationFolder}/${effectiveName}` : effectiveName,
        confidence: fallbackScores[0]?.score ?? 0,
        topScores: fallbackScores,
        summary: fileResult?.analysis?.summary ?? fileResult?.error ?? null,
        calendar: null,
      };
    });
  },
};
