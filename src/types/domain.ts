export type AutomationStatus = "queued" | "processing" | "completed" | "failed";

export interface Category {
  id: string;
  name: string;
  systemGenerated: boolean;
  active: boolean;
}

export interface CategoryScore {
  name: string;
  score: number;
}

export interface ScoringResponse {
  categories: CategoryScore[];
}

export interface RuleMapping {
  categoryName: string;
  folderPath: string;
  isActive: boolean;
}

export interface AutomationLog {
  id: string;
  fileName: string;
  originalPath: string;
  movedTo: string;
  chosenCategory: string;
  score: number;
  allScores: CategoryScore[];
  timestamp: string;
  processingTimeMs: number;
  status: AutomationStatus;
  errorMessage?: string;
}

export interface PrivacyConfig {
  exclusionPatterns: string[];
}

export interface AutomationJob {
  filePath: string;
  fileName: string;
  contentPreview: string;
}

export interface LogFilter {
  search: string;
  status: AutomationStatus | "all";
  category: string;
}

export interface PaginationState {
  page: number;
  pageSize: number;
}
