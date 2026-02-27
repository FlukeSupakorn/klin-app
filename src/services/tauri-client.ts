import { invoke } from "@tauri-apps/api/core";
import type {
  MoveFileDto,
  ReadFolderDto,
  SaveRuleMappingDto,
  TauriClient,
  WatchFolderDto,
  WriteLogDto,
} from "@/types/ipc";
import type { AutomationLog, Category } from "@/types/domain";

class TauriCommandClient implements TauriClient {
  moveFile(input: MoveFileDto): Promise<void> {
    return invoke("move_file", { input });
  }

  readFolder(input: ReadFolderDto): Promise<string[]> {
    return invoke("read_folder", { input });
  }

  pickFilesForOrganize(): Promise<string[]> {
    return invoke("pick_files_for_organize");
  }

  pickFolderForOrganize(): Promise<string | null> {
    return invoke("pick_folder_for_organize");
  }

  deleteFile(filePath: string): Promise<void> {
    return invoke("delete_file", { filePath });
  }

  watchFolder(input: WatchFolderDto): Promise<void> {
    return invoke("watch_folder", { input });
  }

  getDownloadsFolder(): Promise<string> {
    return invoke("get_downloads_folder");
  }

  writeLog(input: WriteLogDto): Promise<void> {
    return invoke("write_log", { input });
  }

  listLogs(): Promise<AutomationLog[]> {
    return invoke("list_logs");
  }

  getCategories(): Promise<Category[]> {
    return invoke("get_categories");
  }

  saveRuleMapping(input: SaveRuleMappingDto): Promise<void> {
    return invoke("save_rule_mapping", { input });
  }
}

export const tauriClient: TauriClient = new TauriCommandClient();
