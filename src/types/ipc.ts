import type { AutomationLog, RuleMapping, Category } from "@/types/domain";

export interface MoveFileDto {
  sourcePath: string;
  destinationPath: string;
}

export interface ReadFolderDto {
  folderPath: string;
}

export interface WatchFolderDto {
  folderPath: string;
}

export interface SaveRuleMappingDto {
  mappings: RuleMapping[];
}

export interface WriteHistoryDto {
  log: AutomationLog;
}

export interface NoteFileEntryDto {
  path: string;
  file_name: string;
  size_bytes: number;
  last_modified_ms: number;
}

export interface AutomationConfigDto {
  auto_organize_enabled: boolean;
  watched_folders: string[];
  scan_interval_seconds: number;
}

export interface SubdirEntry {
  name: string;
  path: string;
  has_children: boolean;
}

export type ModelSlot = 'chat' | 'embed';
export type ModelDownloadSlot = 'chat' | 'embed' | 'mmproj';

export interface ModelConfigEntryDto {
  filename: string;
  sha256: string;
}

export interface ModelConfigDto {
  models: Partial<Record<ModelDownloadSlot, ModelConfigEntryDto>>;
}

export interface InstalledModelDto {
  filename: string;
  path: string;
  sizeBytes: number;
}

export interface DownloadModelDto {
  url: string;
  destFilename: string;
  slot: ModelDownloadSlot;
  expectedSha256: string;
  expectedSize: number;
}

export interface ModelDownloadProgressPayload {
  slot: ModelDownloadSlot;
  downloaded: number;
  total: number;
}

export interface SystemSpecsDto {
  ramTotalBytes: number;
  ramAvailableBytes: number;
  vramBytes?: number | null;
}

export type FrontendLogLevel = "debug" | "info" | "warn" | "error";

export interface FrontendLogPayload {
  level: FrontendLogLevel;
  message: string;
  context?: string;
}

export interface TauriClient {
  moveFile(input: MoveFileDto): Promise<void>;
  readFolder(input: ReadFolderDto): Promise<string[]>;
  ensureLlamaServer(slot: ModelSlot): Promise<void>;
  touchLlamaServer(slot: ModelSlot): Promise<void>;
  stopLlamaServer(slot: ModelSlot): Promise<void>;
  warmupChatModel(): Promise<void>;
  pickFilesForOrganize(): Promise<string[]>;
  pickFolderForOrganize(): Promise<string | null>;
  saveNoteFile(input: { folderPath: string; fileName: string; content: string }): Promise<string>;
  listNoteFiles(folderPath: string): Promise<NoteFileEntryDto[]>;
  readNoteFile(filePath: string): Promise<string>;
  openExternalUrl(url: string): Promise<void>;
  deleteFile(filePath: string): Promise<void>;
  watchFolder(input: WatchFolderDto): Promise<void>;
  getDownloadsFolder(): Promise<string>;
  getAppDataDir(): Promise<string>;
  writeHistory(input: WriteHistoryDto): Promise<void>;
  listHistory(): Promise<AutomationLog[]>;
  getCategories(): Promise<Category[]>;
  saveRuleMapping(input: SaveRuleMappingDto): Promise<void>;
  startOAuthListener(): Promise<void>;
  saveAutomationConfig(config: AutomationConfigDto): Promise<void>;
  loadAutomationConfig(): Promise<AutomationConfigDto>;
  pickFoldersForBatch(): Promise<string[]>;
  listSubdirectories(path: string): Promise<SubdirEntry[]>;
  listAllSubdirectories(path: string): Promise<string[]>;
  ensureCategoryFolders(paths: string[]): Promise<void>;
  writeTextFile(filePath: string, content: string): Promise<void>;
  statFiles(filePaths: string[]): Promise<(NoteFileEntryDto | null)[]>;
  logFrontend(payload: FrontendLogPayload): Promise<void>;
  downloadModel(input: DownloadModelDto): Promise<void>;
  cancelModelDownload(slot: ModelDownloadSlot): Promise<void>;
  getModelDir(): Promise<string>;
  readModelConfig(): Promise<ModelConfigDto>;
  writeModelConfig(slot: ModelDownloadSlot, filename: string, sha256: string): Promise<ModelConfigDto>;
  listInstalledModels(): Promise<InstalledModelDto[]>;
  getSystemSpecs(): Promise<SystemSpecsDto>;
}
