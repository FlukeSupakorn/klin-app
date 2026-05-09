use std::collections::HashMap;
use std::path::Path;
use std::time::{Instant, SystemTime};

use serde::{Deserialize, Serialize};

use crate::domain::{
    dto::SubdirEntry,
    file_operations::{DeleteFileCommand, FileCommand, MoveFileCommand},
};

#[derive(Debug, Clone, Copy, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct FolderStats {
    pub file_count: u64,
    pub total_bytes: u64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FolderStatsTick {
    pub folder_path: String,
    pub file_count: u64,
    pub total_bytes: u64,
    pub done: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileInfo {
    pub size: u64,
    #[serde(with = "system_time_seconds")]
    pub mtime: SystemTime,
}

mod system_time_seconds {
    use serde::{Deserialize, Deserializer, Serializer};
    use std::time::{Duration, SystemTime, UNIX_EPOCH};

    pub fn serialize<S: Serializer>(t: &SystemTime, s: S) -> Result<S::Ok, S::Error> {
        let secs = t.duration_since(UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0);
        s.serialize_u64(secs)
    }

    pub fn deserialize<'de, D: Deserializer<'de>>(d: D) -> Result<SystemTime, D::Error> {
        let secs = u64::deserialize(d)?;
        Ok(UNIX_EPOCH + Duration::from_secs(secs))
    }
}

pub struct WalkOutcome {
    pub stats: FolderStats,
    pub file_index: HashMap<String, FileInfo>,
}

const TICK_INTERVAL_MS: u128 = 50;

pub fn walk_folder_stats_streaming<F>(folder: &Path, mut on_tick: F) -> Result<WalkOutcome, String>
where
    F: FnMut(u64, u64),
{
    if !folder.exists() {
        return Err(format!("folder does not exist: {}", folder.display()));
    }

    let mut total_bytes: u64 = 0;
    let mut file_count: u64 = 0;
    let mut file_index: HashMap<String, FileInfo> = HashMap::new();
    let mut last_tick = Instant::now();

    let walker = jwalk::WalkDir::new(folder)
        .follow_links(false)
        .skip_hidden(false);

    for entry in walker {
        let Ok(entry) = entry else { continue };
        if !entry.file_type().is_file() {
            continue;
        }

        let path = entry.path();
        let metadata = match path.metadata() {
            Ok(m) => m,
            Err(_) => continue,
        };
        let size = metadata.len();
        let mtime = metadata.modified().unwrap_or(SystemTime::UNIX_EPOCH);

        total_bytes = total_bytes.saturating_add(size);
        file_count = file_count.saturating_add(1);

        if let Ok(rel) = path.strip_prefix(folder) {
            let rel_str = rel.to_string_lossy().replace('\\', "/");
            file_index.insert(rel_str, FileInfo { size, mtime });
        }

        if last_tick.elapsed().as_millis() >= TICK_INTERVAL_MS {
            on_tick(file_count, total_bytes);
            last_tick = Instant::now();
        }
    }

    on_tick(file_count, total_bytes);

    Ok(WalkOutcome {
        stats: FolderStats {
            file_count,
            total_bytes,
        },
        file_index,
    })
}

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
