use std::path::PathBuf;
use tauri::Manager;

pub fn resolve_app_data_dir<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map_err(|err| format!("failed to resolve app data dir: {err}"))
}

pub fn resolve_downloads_dir<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
) -> Result<PathBuf, String> {
    app.path()
        .download_dir()
        .map_err(|err| format!("failed to resolve downloads dir: {err}"))
}
