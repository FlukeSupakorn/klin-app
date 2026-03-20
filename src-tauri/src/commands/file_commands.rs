use std::path::PathBuf;

use crate::{
    dto::{MoveFileDto, ReadFolderDto, SubdirEntry, WatchFolderDto},
    infrastructure::watcher,
    services::file_service::FileService,
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
pub fn pick_files_for_organize() -> Result<Vec<String>, String> {
    let selected = rfd::FileDialog::new().pick_files();
    Ok(selected
        .unwrap_or_default()
        .into_iter()
        .map(|path| path.to_string_lossy().to_string())
        .collect())
}

#[tauri::command]
pub fn pick_folder_for_organize() -> Result<Option<String>, String> {
    let selected = rfd::FileDialog::new().pick_folder();
    Ok(selected.map(|path| path.to_string_lossy().to_string()))
}

#[tauri::command]
pub fn pick_folders_for_batch() -> Result<Vec<String>, String> {
    let selected = rfd::FileDialog::new().pick_folders();
    Ok(selected
        .unwrap_or_default()
        .into_iter()
        .map(|path| path.to_string_lossy().to_string())
        .collect())
}

#[tauri::command]
pub fn delete_file(file_path: String) -> Result<(), String> {
    FileService::delete_file(file_path)
}

#[tauri::command]
pub fn list_subdirectories(path: String) -> Result<Vec<SubdirEntry>, String> {
    let dir = PathBuf::from(&path);
    if !dir.exists() {
        return Ok(Vec::new());
    }

    let mut entries: Vec<SubdirEntry> = std::fs::read_dir(&dir)
        .map_err(|err| err.to_string())?
        .filter_map(Result::ok)
        .filter_map(|entry| {
            let p = entry.path();
            if !p.is_dir() {
                return None;
            }
            let name = p.file_name()?.to_string_lossy().to_string();
            let path_str = p.to_string_lossy().to_string();
            let has_children = std::fs::read_dir(&p)
                .map(|mut d| d.any(|e| e.map(|e| e.path().is_dir()).unwrap_or(false)))
                .unwrap_or(false);
            Some(SubdirEntry { name, path: path_str, has_children })
        })
        .collect();

    entries.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    Ok(entries)
}

fn collect_subdirs_recursive(dir: &std::path::Path, result: &mut Vec<String>) {
    if let Ok(entries) = std::fs::read_dir(dir) {
        let mut sorted: Vec<_> = entries.filter_map(Result::ok).collect();
        sorted.sort_by_key(|e| e.file_name());
        for entry in sorted {
            let p = entry.path();
            if p.is_dir() {
                result.push(p.to_string_lossy().to_string());
                collect_subdirs_recursive(&p, result);
            }
        }
    }
}

#[tauri::command]
pub fn list_all_subdirectories(path: String) -> Result<Vec<String>, String> {
    let dir = PathBuf::from(&path);
    if !dir.exists() {
        return Ok(Vec::new());
    }
    let mut result = Vec::new();
    collect_subdirs_recursive(&dir, &mut result);
    Ok(result)
}
