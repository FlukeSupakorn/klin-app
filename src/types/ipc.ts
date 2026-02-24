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

export interface TauriClient {
  moveFile(input: MoveFileDto): Promise<void>;
  readFolder(input: ReadFolderDto): Promise<string[]>;
  deleteFile(filePath: string): Promise<void>;
  watchFolder(input: WatchFolderDto): Promise<void>;
  getDownloadsFolder(): Promise<string>;
  writeLog(input: WriteLogDto): Promise<void>;
  listLogs(): Promise<AutomationLog[]>;
  getCategories(): Promise<Category[]>;
  saveRuleMapping(input: SaveRuleMappingDto): Promise<void>;
}
