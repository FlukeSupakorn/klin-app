use std::collections::HashSet;
use std::path::{Path, PathBuf};

use once_cell::sync::Lazy;
use parking_lot::Mutex;
use tauri::Emitter;

use crate::{
    domain::dto::{MoveFileDto, ReadFolderDto, SubdirEntry, WatchFolderDto},
    infrastructure::fs_ops::{self, FolderStats, FolderStatsTick},
    services::{
        file_service::FileService,
        folder_stats_cache::{self, build_entry_from_walk},
        folder_stats_watcher,
    },
};

static ACTIVE_SCANS: Lazy<Mutex<HashSet<PathBuf>>> = Lazy::new(|| Mutex::new(HashSet::new()));

fn normalize_scan_key(path: &Path) -> PathBuf {
    PathBuf::from(path.to_string_lossy().replace('/', "\\").trim_end_matches('\\'))
}

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

#[tauri::command]
pub fn ensure_category_folders(paths: Vec<String>) -> Result<(), String> {
    FileService::ensure_category_folders(paths)
}

#[tauri::command]
pub fn get_folder_stats_cached(folder_path: String) -> Option<FolderStats> {
    let cache = folder_stats_cache::instance()?;
    let entry = cache.get(Path::new(&folder_path))?;
    if entry.dirty {
        return None;
    }
    Some(entry.stats())
}

#[tauri::command]
pub fn start_folder_stats_scan<R: tauri::Runtime>(
    app: tauri::AppHandle<R>,
    folder_path: String,
) -> Result<(), String> {
    let path = PathBuf::from(&folder_path);
    let key = normalize_scan_key(&path);

    {
        let mut active = ACTIVE_SCANS.lock();
        if active.contains(&key) {
            return Ok(());
        }
        active.insert(key.clone());
    }

    let app_handle = app.clone();
    let folder_for_thread = folder_path.clone();
    let key_for_thread = key.clone();

    std::thread::spawn(move || {
        let folder_path_buf = PathBuf::from(&folder_for_thread);
        let emit_app = app_handle.clone();
        let folder_emit = folder_for_thread.clone();
        let result = fs_ops::walk_folder_stats_streaming(
            &folder_path_buf,
            move |file_count, total_bytes| {
                let tick = FolderStatsTick {
                    folder_path: folder_emit.clone(),
                    file_count,
                    total_bytes,
                    done: false,
                };
                let _ = emit_app.emit("folder-stats-progress", tick);
            },
        );

        match result {
            Ok(outcome) => {
                if let Some(cache) = folder_stats_cache::instance() {
                    let entry = build_entry_from_walk(
                        outcome.stats.file_count,
                        outcome.stats.total_bytes,
                        outcome.file_index,
                    );
                    cache.put(&folder_path_buf, entry);
                }
                let final_tick = FolderStatsTick {
                    folder_path: folder_for_thread.clone(),
                    file_count: outcome.stats.file_count,
                    total_bytes: outcome.stats.total_bytes,
                    done: true,
                };
                let _ = app_handle.emit("folder-stats-progress", final_tick);
                folder_stats_watcher::emit_for(&app_handle, &folder_for_thread, outcome.stats);
            }
            Err(err) => {
                tracing::info!(
                    "[folder-stats] scan failed for {}: {}",
                    folder_for_thread,
                    err
                );
                let final_tick = FolderStatsTick {
                    folder_path: folder_for_thread.clone(),
                    file_count: 0,
                    total_bytes: 0,
                    done: true,
                };
                let _ = app_handle.emit("folder-stats-progress", final_tick);
            }
        }

        ACTIVE_SCANS.lock().remove(&key_for_thread);
    });

    Ok(())
}

#[tauri::command]
pub fn register_folder_stats_watcher<R: tauri::Runtime>(
    app: tauri::AppHandle<R>,
    folder_path: String,
) -> Result<(), String> {
    folder_stats_watcher::register(app, Path::new(&folder_path))
}

#[tauri::command]
pub fn unregister_folder_stats_watcher(folder_path: String) -> Result<(), String> {
    folder_stats_watcher::unregister(Path::new(&folder_path));
    Ok(())
}
