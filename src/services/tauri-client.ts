import { invoke } from "@tauri-apps/api/core";
import type {
  AutomationConfigDto,
  FrontendLogPayload,
  DownloadModelDto,
  InstalledModelDto,
  ModelConfigDto,
  ModelDownloadSlot,
  ModelSlot,
  MoveFileDto,
  NoteFileEntryDto,
  ReadFolderDto,
  SaveRuleMappingDto,
  SystemSpecsDto,
  SubdirEntry,
  TauriClient,
  WatchFolderDto,
  WriteHistoryDto,
} from "@/types/ipc";
import type { AutomationLog, Category } from "@/types/domain";

class TauriCommandClient implements TauriClient {
  moveFile(input: MoveFileDto): Promise<void> {
    return invoke("move_file", { input });
  }

  readFolder(input: ReadFolderDto): Promise<string[]> {
    return invoke("read_folder", { input });
  }

  ensureLlamaServer(slot: ModelSlot): Promise<void> {
    return invoke("ensure_llama_server", { slot });
  }

  touchLlamaServer(slot: ModelSlot): Promise<void> {
    return invoke("touch_llama_server", { slot });
  }

  stopLlamaServer(slot: ModelSlot): Promise<void> {
    return invoke("stop_llama_server", { slot });
  }

  warmupChatModel(): Promise<void> {
    return invoke("warmup_chat_model");
  }

  pickFilesForOrganize(): Promise<string[]> {
    return invoke("pick_files_for_organize");
  }

  pickFolderForOrganize(): Promise<string | null> {
    return invoke("pick_folder_for_organize");
  }

  saveNoteFile(input: { folderPath: string; fileName: string; content: string }): Promise<string> {
    return invoke("save_note_file", input);
  }

  listNoteFiles(folderPath: string): Promise<NoteFileEntryDto[]> {
    return invoke("list_note_files", { folderPath });
  }

  readNoteFile(filePath: string): Promise<string> {
    return invoke("read_note_file", { filePath });
  }

  openExternalUrl(url: string): Promise<void> {
    return invoke("open_external_url", { url });
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

  getAppDataDir(): Promise<string> {
    return invoke("get_app_data_dir");
  }

  writeHistory(input: WriteHistoryDto): Promise<void> {
    return invoke("write_history", { input });
  }

  listHistory(): Promise<AutomationLog[]> {
    return invoke("list_history");
  }

  getCategories(): Promise<Category[]> {
    return invoke("get_categories");
  }

  saveRuleMapping(input: SaveRuleMappingDto): Promise<void> {
    return invoke("save_rule_mapping", { input });
  }

  startOAuthListener(): Promise<void> {
    return invoke("start_oauth_listener");
  }

  saveAutomationConfig(config: AutomationConfigDto): Promise<void> {
    return invoke("save_automation_config", { config });
  }

  loadAutomationConfig(): Promise<AutomationConfigDto> {
    return invoke("load_automation_config");
  }

  pickFoldersForBatch(): Promise<string[]> {
    return invoke("pick_folders_for_batch");
  }

  listSubdirectories(path: string): Promise<SubdirEntry[]> {
    return invoke("list_subdirectories", { path });
  }

  listAllSubdirectories(path: string): Promise<string[]> {
    return invoke("list_all_subdirectories", { path });
  }

  ensureCategoryFolders(paths: string[]): Promise<void> {
    return invoke("ensure_category_folders", { paths });
  }

  writeTextFile(filePath: string, content: string): Promise<void> {
    return invoke("write_text_file", { filePath, content });
  }

  statFiles(filePaths: string[]): Promise<(NoteFileEntryDto | null)[]> {
    return invoke("stat_files", { filePaths });
  }

  logFrontend(payload: FrontendLogPayload): Promise<void> {
    return invoke("log_frontend", { payload });
  }

  downloadModel(input: DownloadModelDto): Promise<void> {
    return invoke("download_model", { ...input });
  }

  cancelModelDownload(slot: ModelDownloadSlot): Promise<void> {
    return invoke("cancel_model_download", { slot });
  }

  getModelDir(): Promise<string> {
    return invoke("get_model_dir");
  }

  readModelConfig(): Promise<ModelConfigDto> {
    return invoke("read_model_config");
  }

  writeModelConfig(slot: ModelDownloadSlot, filename: string, sha256: string): Promise<ModelConfigDto> {
    return invoke("write_model_config", { slot, filename, sha256 });
  }

  listInstalledModels(): Promise<InstalledModelDto[]> {
    return invoke("list_installed_models");
  }

  getSystemSpecs(): Promise<SystemSpecsDto> {
    return invoke("get_system_specs");
  }
}

export const tauriClient: TauriClient = new TauriCommandClient();
