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
  color: string;
  icon: string;
  folderPath: string;
  enabled: boolean;
  aiLearned: boolean;
  isAutoDescription: boolean;
}

export interface CategoryScore {
  categoryId?: string;
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
  workerFileId: string | null;
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
  schedule: ScheduleExtractionDto | null;
  analysisStatus: AutomationStatus;
  analysisError: string | null;
  analysisDurationMs: number | null;
  moveStatus: OrganizeMoveStatus;
  // Tracks the exact file move operation so undo remains correct even if UI destination is edited later.
  lastMovedFromPath?: string | null;
  lastMovedToPath?: string | null;
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

export interface ScheduleEventCandidateDto {
  type: import("./calendar-events").ScheduleEventType;
  confidence: number;
  source_pages: number[];
  source_text: string;
  missing_fields: string[];
  google_event: import("./calendar-events").GoogleCalendarEventDraft | null;
}

export interface ScheduleExtractionDto {
  events: ScheduleEventCandidateDto[];
  error: string | null;
}

export interface OrganizeAnalyzeFileResult {
  file_id: string;
  // New worker shape: suggested_names is top-level. `analysis` is kept optional
  // so old worker payloads still parse.
  suggested_names?: string[];
  analysis?: OrganizeAnalyzeAnalysis;
  categories: OrganizeAnalyzeCategoryScore[];
  error: string | null;
  schedule?: ScheduleExtractionDto | null;
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

export type SemanticStatus = "ready" | "pending" | "degraded" | "not_ready";

export interface FileSearchResponse {
  results: FileSearchResultItem[];
  semanticStatus: SemanticStatus;
  semanticError: string | null;
  indexingPendingCount: number;
}
