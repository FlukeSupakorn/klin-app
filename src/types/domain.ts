export type AutomationStatus = "queued" | "processing" | "completed" | "failed";
export type OrganizeMoveStatus = "idle" | "processing" | "completed" | "failed";

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
  lockedPaths: string[];
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
  analysisStatus: AutomationStatus;
  analysisError: string | null;
  moveStatus: OrganizeMoveStatus;
}

export interface OrganizeAnalyzeRequest {
  file_paths: string[];
}

export interface OrganizeAnalyzeCategoryScore {
  category_id: string;
  name: string;
  score: number;
}

export interface OrganizeAnalyzeAnalysis {
  summary?: string | null;
  suggested_names: string[];
}

export interface OrganizeAnalyzeFileResult {
  file_id: string;
  analysis: OrganizeAnalyzeAnalysis;
  categories: OrganizeAnalyzeCategoryScore[];
  error: string | null;
}

export interface OrganizeAnalyzeResponse {
  results: Record<string, OrganizeAnalyzeFileResult>;
}

export interface FileSearchRequest {
  query: string;
}

export interface FileSearchResultItem {
  id: string;
  fileName: string;
  fileType: string;
  sizeBytes: number;
  folder: string;
  lastEdited: string;
  path: string;
}

export interface FileSearchResponse {
  results: FileSearchResultItem[];
}
