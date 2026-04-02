use crate::{
    domain::dto::{MoveFileDto, ReadFolderDto, SubdirEntry, WatchFolderDto},
    services::file_service::FileService,
};

#[tauri::command]
pub fn watch_folder<R: tauri::Runtime>(
    app: tauri::AppHandle<R>,
    input: WatchFolderDto,
) -> Result<(), String> {
    FileService::watch_folder(app, input.folder_path)
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
pub async fn pick_files_for_organize() -> Result<Vec<String>, String> {
    let selected = rfd::AsyncFileDialog::new().pick_files().await;
    Ok(selected
        .unwrap_or_default()
        .into_iter()
    .map(|handle| handle.path().to_string_lossy().to_string())
        .collect())
}

#[tauri::command]
pub async fn pick_folder_for_organize() -> Result<Option<String>, String> {
    let selected = rfd::AsyncFileDialog::new().pick_folder().await;
    Ok(selected.map(|handle| handle.path().to_string_lossy().to_string()))
}

#[tauri::command]
pub async fn pick_folders_for_batch() -> Result<Vec<String>, String> {
    let selected = rfd::AsyncFileDialog::new().pick_folders().await;
    Ok(selected
        .unwrap_or_default()
        .into_iter()
    .map(|handle| handle.path().to_string_lossy().to_string())
        .collect())
}

#[tauri::command]
pub fn delete_file(file_path: String) -> Result<(), String> {
    FileService::delete_file(file_path)
}

#[tauri::command]
pub fn list_subdirectories(path: String) -> Result<Vec<SubdirEntry>, String> {
    FileService::list_subdirectories(path)
}

#[tauri::command]
pub fn list_all_subdirectories(path: String) -> Result<Vec<String>, String> {
    FileService::list_all_subdirectories(path)
}
