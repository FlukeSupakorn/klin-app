import type {
  CategoryScore,
  ManagedCategory,
  OrganizeAnalyzeRequest,
  OrganizeAnalyzeResponse,
  OrganizePreviewItem,
} from "@/types/domain";

const ORGANIZE_API_URL_CANDIDATES = [
  "http://localhost:3000/organize",
  "http://localhost:3000/organize/analyze",
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

function parseScoreEntries(rawScore: unknown): CategoryScore[] {
  if (Array.isArray(rawScore)) {
    return rawScore
      .map((entry) => {
        if (!entry || typeof entry !== "object") {
          return null;
        }
        const name = "name" in entry ? String(entry.name ?? "") : "";
        const score = "score" in entry ? Number(entry.score) : Number.NaN;
        if (!name) {
          return null;
        }
        return { name, score: normalizeScore(score) };
      })
      .filter((entry): entry is CategoryScore => entry !== null)
      .sort((a, b) => b.score - a.score);
  }

  if (rawScore && typeof rawScore === "object") {
    return Object.entries(rawScore)
      .map(([name, score]) => ({
        name,
        score: normalizeScore(Number(score)),
      }))
      .filter((entry) => entry.name.length > 0)
      .sort((a, b) => b.score - a.score);
  }

  if (typeof rawScore === "string") {
    return rawScore
      .replace(/^[\[{\s]+|[\]}\s]+$/g, "")
      .split(",")
      .map((chunk) => chunk.trim())
      .filter(Boolean)
      .map((chunk) => {
        const [namePart, scorePart] = chunk.split(":");
        return {
          name: (namePart ?? "").trim(),
          score: normalizeScore(Number((scorePart ?? "0").trim())),
        };
      })
      .filter((entry) => entry.name.length > 0)
      .sort((a, b) => b.score - a.score);
  }

  return [];
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

function buildRequest(paths: string[], categoryCatalog: ManagedCategory[]): OrganizeAnalyzeRequest {
  const enabledCategories = categoryCatalog.filter((category) => category.enabled);

  return {
    filePaths: paths,
    categories: enabledCategories.map((category) => ({
      name: category.name,
      description: category.description,
    })),
  };
}

function normalizeResultMap(payload: unknown): Record<string, Record<string, unknown>> {
  if (!payload || typeof payload !== "object") {
    return {};
  }

  const root = payload as {
    result?: unknown;
    reuslt?: unknown;
  };

  const candidate = root.result ?? root.reuslt;

  if (candidate && typeof candidate === "object" && !Array.isArray(candidate)) {
    return candidate as Record<string, Record<string, unknown>>;
  }

  if (Array.isArray(candidate)) {
    return candidate.reduce<Record<string, Record<string, unknown>>>((acc, entry) => {
      if (!entry || typeof entry !== "object") {
        return acc;
      }

      Object.entries(entry).forEach(([filePath, value]) => {
        if (value && typeof value === "object") {
          acc[filePath] = value as Record<string, unknown>;
        }
      });

      return acc;
    }, {});
  }

  return {};
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

    const requestPayload = buildRequest(paths, categoryCatalog);
    const payload = (await postAnalyze(requestPayload)) as OrganizeAnalyzeResponse & { reuslt?: unknown };
    const resultMap = normalizeResultMap(payload);

    const categoryPathMap = new Map(categoryCatalog.map((category) => [category.name, category.folderPath]));

    return paths.map((path, index) => {
      const fileName = path.split(/[\\/]/).pop() ?? `file-${index + 1}`;
      const fileResult = resultMap[path];
      const topScores = parseScoreEntries(fileResult?.score);
      const fallbackScores = topScores.length > 0 ? topScores : buildFallbackScores(categoryCatalog);
      const selectedCategory = fallbackScores[0]?.name ?? "Uncategorized";
      const destinationFolder = categoryPathMap.get(selectedCategory) ?? categoryCatalog[0]?.folderPath ?? "";
      const suggestedNames = parseSuggestedNames(fileResult?.new_name);

      return {
        id: crypto.randomUUID(),
        fileName,
        currentPath: path,
        suggestedNames,
        suggestedName: null,
        selectedCategory,
        destinationPath: destinationFolder ? `${destinationFolder}/${fileName}` : fileName,
        confidence: fallbackScores[0]?.score ?? 0,
        topScores: fallbackScores,
        summary: typeof fileResult?.summary === "string" ? fileResult.summary : null,
        calendar: typeof fileResult?.calendar === "string" ? fileResult.calendar : null,
      };
    });
  },
};
