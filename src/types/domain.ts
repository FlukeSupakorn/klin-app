export type AutomationStatus = "queued" | "processing" | "completed" | "failed";

export interface Category {
  id: string;
  name: string;
  systemGenerated: boolean;
  active: boolean;
}

export interface ManagedCategory {
  id: string;
  name: string;
  description: string;
  folderPath: string;
  enabled: boolean;
  aiLearned: boolean;
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
  itemType?: "file" | "folder";
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

export interface OrganizePreviewItem {
  id: string;
  fileName: string;
  currentPath: string;
  suggestedNames: string[];
  suggestedName: string | null;
  selectedCategory: string;
  destinationPath: string;
  confidence: number;
  topScores: CategoryScore[];
  summary: string | null;
  calendar: string | null;
}

export interface OrganizeAnalyzeRequest {
  filePaths: string[];
  categories: Array<{
    name: string;
    description: string;
  }>;
}

export interface OrganizeAnalyzeFileResult {
  score: Record<string, number>;
  new_name: string[];
  summary: string | null;
  calendar: string | null;
}

export interface OrganizeAnalyzeResponse {
  result: Record<string, OrganizeAnalyzeFileResult>;
}
