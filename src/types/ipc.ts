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

export interface WriteLogDto {
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

export interface TauriClient {
  moveFile(input: MoveFileDto): Promise<void>;
  readFolder(input: ReadFolderDto): Promise<string[]>;
  ensureLlamaServer(slot: ModelSlot): Promise<void>;
  /** Refresh the idle timer without a full TCP probe. Call before/after any
   *  request to llama-server so the idle-timeout task does not kill the server
   *  mid-request (e.g. during long SSE streams). */
  touchLlamaServer(slot: ModelSlot): Promise<void>;
  /**
   * Explicitly stop the llama-server process to free RAM/VRAM.
   * It will be re-spawned automatically on the next `ensureLlamaServer()` call.
   */
  stopLlamaServer(slot: ModelSlot): Promise<void>;
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
  writeLog(input: WriteLogDto): Promise<void>;
  listLogs(): Promise<AutomationLog[]>;
  getCategories(): Promise<Category[]>;
  saveRuleMapping(input: SaveRuleMappingDto): Promise<void>;
  startOAuthListener(): Promise<void>;
  saveAutomationConfig(config: AutomationConfigDto): Promise<void>;
  loadAutomationConfig(): Promise<AutomationConfigDto>;
  pickFoldersForBatch(): Promise<string[]>;
  listSubdirectories(path: string): Promise<SubdirEntry[]>;
  listAllSubdirectories(path: string): Promise<string[]>;
}
