use std::path::PathBuf;

use tauri::State;

use crate::{
    dto::{CategoryDto, MoveFileDto, ReadFolderDto, SaveRuleMappingDto, WatchFolderDto, WriteLogDto},
    infrastructure::{app_paths, watcher},
    services::file_service::FileService,
    AppState,
};

#[tauri::command]
pub fn watch_folder(input: WatchFolderDto) -> Result<(), String> {
    watcher::watch_folder(PathBuf::from(input.folder_path).as_path())
}

#[tauri::command]
pub fn move_file(input: MoveFileDto) -> Result<(), String> {
    FileService::move_file(input.source_path, input.destination_path)
}

#[tauri::command]
pub fn read_folder(input: ReadFolderDto) -> Result<Vec<String>, String> {
    FileService::read_folder(input.folder_path)
}

#[tauri::command]
pub fn delete_file(file_path: String) -> Result<(), String> {
    FileService::delete_file(file_path)
}

#[tauri::command]
pub fn get_downloads_folder<R: tauri::Runtime>(app: tauri::AppHandle<R>) -> Result<String, String> {
    app_paths::resolve_downloads_dir(&app).map(|path| path.to_string_lossy().to_string())
}

#[tauri::command]
pub fn write_log(state: State<AppState>, input: WriteLogDto) -> Result<(), String> {
    state.log_service.lock().write_log(input.log)
}

#[tauri::command]
pub fn list_logs(state: State<AppState>) -> Result<Vec<crate::domain::entities::AutomationLog>, String> {
    state.log_service.lock().list_logs()
}

#[tauri::command]
pub fn get_categories(state: State<AppState>) -> Result<Vec<CategoryDto>, String> {
    state
        .category_service
        .lock()
        .list_categories()
        .map(|categories| categories.into_iter().map(CategoryDto::from).collect())
}

#[tauri::command]
pub fn save_rule_mapping(state: State<AppState>, input: SaveRuleMappingDto) -> Result<(), String> {
    state.rule_service.lock().save_mappings(input.mappings)
}
