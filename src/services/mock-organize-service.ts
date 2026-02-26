import type { CategoryScore, ManagedCategory, OrganizePreviewItem } from "@/types/domain";

interface RenameSuggestionStrategy {
  suggest(fileName: string): string | null;
}

class HeuristicRenameSuggestionStrategy implements RenameSuggestionStrategy {
  suggest(fileName: string): string | null {
    const sanitized = fileName
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (sanitized === fileName || sanitized.length < 6) {
      return null;
    }

    const extension = fileName.includes(".") ? fileName.slice(fileName.lastIndexOf(".")) : "";
    const base = sanitized.replace(extension, "");
    const normalizedBase =
      base
        .split(" ")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
        .join(" ") || fileName;

    return `${normalizedBase}${extension}`;
  }
}

function buildTopScores(categoryNames: string[]): CategoryScore[] {
  const raw = categoryNames.map((name) => ({
    name,
    score: Math.max(0.12, Math.random()),
  }));

  const total = raw.reduce((acc, item) => acc + item.score, 0);

  return raw
    .map((item) => ({
      ...item,
      score: Number((item.score / total).toFixed(4)),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

export class MockOrganizePreviewFactory {
  private static renameStrategy: RenameSuggestionStrategy = new HeuristicRenameSuggestionStrategy();

  static create(categoryCatalog: ManagedCategory[]): OrganizePreviewItem[] {
    const enabledCategories = categoryCatalog.filter((category) => category.enabled);
    const categoryNames = enabledCategories.map((category) => category.name);

    const mockFiles = [
      {
        id: "file-1",
        fileName: "receipt_2025-11-supermarket.jpg",
        currentPath: "/Users/sarun/Pictures/receipt_2025-11-supermarket.jpg",
      },
      {
        id: "file-2",
        fileName: "Screenshot 2025-05-21 123359.png",
        currentPath: "/Users/sarun/Pictures/Screenshot 2025-05-21 123359.png",
      },
    ];

    return mockFiles.map((file) => {
      const topScores = buildTopScores(categoryNames.length ? categoryNames : ["Documents"]);
      const selectedCategory = topScores[0]?.name ?? "Documents";
      const matchedCategory = enabledCategories.find((category) => category.name === selectedCategory);
      const destinationRoot = matchedCategory?.folderPath ?? "/Users/sarun/Pictures/Documents";

      return {
        id: file.id,
        fileName: file.fileName,
        currentPath: file.currentPath,
        confidence: topScores[0]?.score ?? 0,
        selectedCategory,
        topScores,
        suggestedName: null,
        destinationPath: `${destinationRoot}/${file.fileName}`,
      };
    });
  }

  static applyCategory(item: OrganizePreviewItem, category: ManagedCategory): OrganizePreviewItem {
    return {
      ...item,
      selectedCategory: category.name,
      destinationPath: `${category.folderPath}/${item.fileName}`,
    };
  }

  static toggleRename(item: OrganizePreviewItem, enabled: boolean): OrganizePreviewItem {
    const suggestion = enabled ? this.renameStrategy.suggest(item.fileName) : null;
    const finalName = suggestion ?? item.fileName;

    const destinationFolder = item.destinationPath.includes("/")
      ? item.destinationPath.slice(0, item.destinationPath.lastIndexOf("/"))
      : item.destinationPath;

    return {
      ...item,
      suggestedName: suggestion,
      destinationPath: `${destinationFolder}/${finalName}`,
    };
  }
}
