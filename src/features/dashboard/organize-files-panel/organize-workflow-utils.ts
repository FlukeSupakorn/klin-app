import type { ManagedCategory, OrganizePreviewItem } from "@/types/domain";
import { normalizeCategoryLabel } from "@/lib/text-utils";

export interface OrganizeWorkflowMetrics {
  queuedCount: number;
  processingCount: number;
  readyCount: number;
  failedCount: number;
  movedCount: number;
  readyToMoveCount: number;
  allReadyMoved: boolean;
  canUndoAll: boolean;
  unresolvedCount: number;
  showResumeOrganizeBubble: boolean;
}

export function normalizeSelectedPaths(paths: string[]): string[] {
  return [...new Set(paths.map((path) => path.trim()).filter(Boolean))];
}

export function buildQueuedItem(path: string, categories: ManagedCategory[], defaultFolder: string): OrganizePreviewItem {
  const fileName = path.split(/[\\/]/).pop() ?? "unknown-file";
  const firstEnabled = categories.find((category) => category.enabled) ?? categories[0];
  const selectedCategory = firstEnabled?.name ?? "Uncategorized";
  const destinationFolder = firstEnabled?.folderPath ?? defaultFolder;
  const separator = destinationFolder.includes("\\") ? "\\" : "/";
  const destinationPath = destinationFolder ? `${destinationFolder}${separator}${fileName}` : fileName;

  return {
    id: crypto.randomUUID(),
    workerFileId: null,
    fileName,
    currentPath: path,
    suggestedNames: [],
    suggestedName: null,
    selectedCategory,
    destinationPath,
    confidence: 0,
    topScores: [{ name: selectedCategory, score: 0 }],
    summary: null,
    calendar: null,
    analysisStatus: "queued",
    analysisError: null,
    moveStatus: "idle",
    lastMovedFromPath: null,
    lastMovedToPath: null,
  };
}

function findCategoryByLabel(label: string, categories: ManagedCategory[]): ManagedCategory | undefined {
  const normalizedLabel = normalizeCategoryLabel(label);

  const exact = categories.find((entry) => normalizeCategoryLabel(entry.name) === normalizedLabel);
  if (exact) {
    return exact;
  }

  const contains = categories.find((entry) => {
    const normalizedCategory = normalizeCategoryLabel(entry.name);
    return normalizedCategory.includes(normalizedLabel) || normalizedLabel.includes(normalizedCategory);
  });

  if (contains) {
    return contains;
  }

  const firstToken = normalizedLabel.split(" ")[0] ?? "";
  if (!firstToken) {
    return undefined;
  }

  return categories.find((entry) => normalizeCategoryLabel(entry.name).includes(firstToken));
}

export function applyCategoryToItem(
  item: OrganizePreviewItem,
  categoryName: string,
  categories: ManagedCategory[],
  defaultFolder: string,
): OrganizePreviewItem {
  const category = findCategoryByLabel(categoryName, categories);
  const activeName = item.suggestedName ?? item.fileName;
  const folderPath = category ? category.folderPath : `${defaultFolder}/${categoryName}`;
  const separator = folderPath.includes("\\") ? "\\" : "/";

  return {
    ...item,
    selectedCategory: category?.name ?? categoryName,
    destinationPath: `${folderPath}${separator}${activeName}`,
  };
}

export function applySuggestedNameToItem(item: OrganizePreviewItem, selectedName: string | null): OrganizePreviewItem {
  const slashIndex = Math.max(item.destinationPath.lastIndexOf("/"), item.destinationPath.lastIndexOf("\\"));
  const folderPath = slashIndex >= 0 ? item.destinationPath.slice(0, slashIndex) : item.destinationPath;
  const finalName = selectedName ?? item.fileName;
  const separator = folderPath.includes("\\") ? "\\" : "/";

  return {
    ...item,
    suggestedName: selectedName,
    destinationPath: `${folderPath}${separator}${finalName}`,
  };
}

export function computeOrganizeWorkflowMetrics(
  items: OrganizePreviewItem[],
  modalOpen: boolean,
  isAnalyzing: boolean,
  resumeDismissed: boolean,
): OrganizeWorkflowMetrics {
  const queuedCount = items.filter((item) => item.analysisStatus === "queued").length;
  const processingCount = items.filter((item) => item.analysisStatus === "processing").length;
  const readyCount = items.filter((item) => item.analysisStatus === "completed").length;
  const failedCount = items.filter((item) => item.analysisStatus === "failed").length;
  const movedCount = items.filter((item) => item.moveStatus === "completed").length;
  const readyToMoveCount = items.filter((item) => item.analysisStatus === "completed" && item.moveStatus !== "completed").length;
  const allReadyMoved = readyCount > 0 && readyToMoveCount === 0;
  const canUndoAll = readyCount > 0 && items.every((item) => item.analysisStatus !== "completed" || item.moveStatus === "completed");
  const unresolvedCount = items.filter((item) => item.moveStatus !== "completed").length;
  const showResumeOrganizeBubble = !resumeDismissed && !modalOpen && items.length > 0 && (isAnalyzing || unresolvedCount > 0);

  return {
    queuedCount,
    processingCount,
    readyCount,
    failedCount,
    movedCount,
    readyToMoveCount,
    allReadyMoved,
    canUndoAll,
    unresolvedCount,
    showResumeOrganizeBubble,
  };
}
