use std::path::Path;

use crate::domain::{
    dto::SubdirEntry,
    file_operations::{DeleteFileCommand, FileCommand, MoveFileCommand},
};

impl FileCommand for MoveFileCommand {
    fn execute(&self) -> Result<(), String> {
        move_file(&self.source_path, &self.destination_path)
    }
}

impl FileCommand for DeleteFileCommand {
    fn execute(&self) -> Result<(), String> {
        delete_file(&self.file_path)
    }
}

pub fn move_file(source: &Path, destination: &Path) -> Result<(), String> {
    if let Some(parent) = destination.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|err| format!("create destination parent failed: {err}"))?;
    }
    std::fs::rename(source, destination).map_err(|err| format!("move file failed: {err}"))
}

pub fn read_folder(folder: &Path) -> Result<Vec<String>, String> {
    let entries = std::fs::read_dir(folder).map_err(|err| format!("read folder failed: {err}"))?;
    let mut files = Vec::new();
    for entry in entries {
        let entry = entry.map_err(|err| format!("read entry failed: {err}"))?;
        let path = entry.path();
        if path.is_file() {
            files.push(path.to_string_lossy().to_string());
        }
    }
    Ok(files)
}

pub fn delete_file(path: &Path) -> Result<(), String> {
    std::fs::remove_file(path).map_err(|err| format!("delete file failed: {err}"))
}

pub fn list_subdirectories(path: &Path) -> Result<Vec<SubdirEntry>, String> {
    if !path.exists() {
        return Ok(Vec::new());
    }
    let mut entries: Vec<SubdirEntry> = std::fs::read_dir(path)
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
            Some(SubdirEntry {
                name,
                path: path_str,
                has_children,
            })
        })
        .collect();
    entries.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    Ok(entries)
}

pub fn list_all_subdirectories(path: &Path) -> Result<Vec<String>, String> {
    if !path.exists() {
        return Ok(Vec::new());
    }
    let mut result = Vec::new();
    collect_subdirs_recursive(path, &mut result);
    Ok(result)
}

pub fn ensure_category_folders(paths: Vec<String>) -> Result<(), String> {
    let mut created = 0u32;
    for path in &paths {
        let p = Path::new(path);
        if p.exists() {
            continue;
        }
        match std::fs::create_dir_all(p) {
            Ok(()) => {
                tracing::info!("[startup] created category folder: {}", path);
                created += 1;
            }
            Err(e) => {
                tracing::warn!("[startup] could not create category folder {}: {}", path, e);
            }
        }
    }
    if created > 0 {
        tracing::info!("[startup] ensure_category_folders: {} folder(s) created", created);
    }
    Ok(())
}

fn collect_subdirs_recursive(dir: &Path, result: &mut Vec<String>) {
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
