use crate::infrastructure::app_paths;

#[tauri::command]
pub fn get_downloads_folder<R: tauri::Runtime>(app: tauri::AppHandle<R>) -> Result<String, String> {
    app_paths::resolve_downloads_dir(&app).map(|path| path.to_string_lossy().to_string())
}

#[tauri::command]
pub fn get_app_data_dir<R: tauri::Runtime>(app: tauri::AppHandle<R>) -> Result<String, String> {
    app_paths::resolve_app_data_dir(&app).map(|path| path.to_string_lossy().to_string())
}

#[tauri::command]
pub fn open_external_url(url: String) -> Result<(), String> {
    open::that(url).map_err(|error| error.to_string())
}
