import type { RuleMapping } from "@/types/domain";

export class RuleEngine {
  static resolveTargetFolder(categoryName: string, mappings: RuleMapping[]): string | null {
    const mapping = mappings.find((entry) => entry.categoryName === categoryName && entry.isActive);
    return mapping?.folderPath ?? null;
  }
}
