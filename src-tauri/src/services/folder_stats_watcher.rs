use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::SystemTime;

use notify::{
    event::{ModifyKind, RenameMode},
    Config, Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher,
};
use once_cell::sync::Lazy;
use parking_lot::Mutex;
use serde::Serialize;
use tauri::{AppHandle, Emitter, Runtime};

use crate::infrastructure::fs_ops::{FileInfo, FolderStats};
use crate::services::folder_stats_cache::{self, IndexChange};

struct WatcherSlot {
    _watcher: RecommendedWatcher,
}

static WATCHERS: Lazy<Mutex<HashMap<PathBuf, WatcherSlot>>> =
    Lazy::new(|| Mutex::new(HashMap::new()));
// Buffer rename-from paths until rename-to arrives.
static PENDING_RENAME_FROM: Lazy<Mutex<HashMap<PathBuf, PathBuf>>> =
    Lazy::new(|| Mutex::new(HashMap::new()));

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FolderStatsUpdated {
    pub folder_path: String,
    pub file_count: u64,
    pub total_bytes: u64,
}

fn normalize(path: &Path) -> PathBuf {
    PathBuf::from(path.to_string_lossy().replace('/', "\\").trim_end_matches('\\'))
}

fn relative_to(folder: &Path, file: &Path) -> Option<String> {
    file.strip_prefix(folder)
        .ok()
        .map(|p| p.to_string_lossy().replace('\\', "/"))
}

fn emit_updated<R: Runtime>(app: &AppHandle<R>, folder: &str, stats: FolderStats) {
    let payload = FolderStatsUpdated {
        folder_path: folder.to_string(),
        file_count: stats.file_count,
        total_bytes: stats.total_bytes,
    };
    let _ = app.emit("folder-stats-updated", payload);
}

fn handle_event<R: Runtime>(app: &AppHandle<R>, folder_path: &Path, event: Event) {
    let cache = match folder_stats_cache::instance() {
        Some(c) => c,
        None => return,
    };

    let folder_str = folder_path.to_string_lossy().to_string();

    match event.kind {
        EventKind::Create(_) => {
            for path in event.paths {
                if path.is_dir() {
                    continue;
                }
                let Some(rel) = relative_to(folder_path, &path) else {
                    continue;
                };
                if let Ok(meta) = path.metadata() {
                    if meta.is_file() {
                        let info = FileInfo {
                            size: meta.len(),
                            mtime: meta.modified().unwrap_or(SystemTime::UNIX_EPOCH),
                        };
                        if let Some(stats) = cache.apply_delta(
                            folder_path,
                            Some(&rel),
                            IndexChange::Insert(info),
                        ) {
                            emit_updated(app, &folder_str, stats);
                        }
                    }
                }
            }
        }
        EventKind::Modify(ModifyKind::Name(rename_mode)) => {
            // Rename events come in two parts on most platforms: From + To.
            // RenameMode::Both can deliver both paths in one event.
            match rename_mode {
                RenameMode::From => {
                    if let Some(p) = event.paths.into_iter().next() {
                        PENDING_RENAME_FROM.lock().insert(normalize(&p), p);
                    }
                }
                RenameMode::To => {
                    if let Some(to) = event.paths.into_iter().next() {
                        // Try to find the matching "from" — best-effort match by parent folder
                        let from = PENDING_RENAME_FROM
                            .lock()
                            .drain()
                            .next()
                            .map(|(_, v)| v);
                        apply_rename(app, folder_path, &folder_str, &cache, from.as_deref(), &to);
                    }
                }
                RenameMode::Both => {
                    let mut paths = event.paths.into_iter();
                    let from = paths.next();
                    let to = paths.next();
                    if let (Some(from), Some(to)) = (from, to) {
                        apply_rename(
                            app,
                            folder_path,
                            &folder_str,
                            &cache,
                            Some(from.as_path()),
                            &to,
                        );
                    }
                }
                _ => {
                    cache.mark_dirty(folder_path);
                }
            }
        }
        EventKind::Modify(_) => {
            for path in event.paths {
                if path.is_dir() {
                    continue;
                }
                let Some(rel) = relative_to(folder_path, &path) else {
                    continue;
                };
                if let Ok(meta) = path.metadata() {
                    if meta.is_file() {
                        let info = FileInfo {
                            size: meta.len(),
                            mtime: meta.modified().unwrap_or(SystemTime::UNIX_EPOCH),
                        };
                        if let Some(stats) = cache.apply_delta(
                            folder_path,
                            Some(&rel),
                            IndexChange::Modify(info),
                        ) {
                            emit_updated(app, &folder_str, stats);
                        }
                    }
                }
            }
        }
        EventKind::Remove(_) => {
            for path in event.paths {
                let Some(rel) = relative_to(folder_path, &path) else {
                    continue;
                };
                if let Some(stats) =
                    cache.apply_delta(folder_path, Some(&rel), IndexChange::Remove)
                {
                    emit_updated(app, &folder_str, stats);
                }
            }
        }
        _ => {}
    }
}

fn apply_rename<R: Runtime>(
    app: &AppHandle<R>,
    folder_path: &Path,
    folder_str: &str,
    cache: &folder_stats_cache::FolderStatsCache,
    from: Option<&Path>,
    to: &Path,
) {
    let to_rel = match relative_to(folder_path, to) {
        Some(r) => r,
        None => return,
    };
    let from_rel = from.and_then(|p| relative_to(folder_path, p));

    match (from_rel, from) {
        (Some(from_rel), Some(_)) => {
            // Rename within folder
            if let Some(stats) = cache.apply_delta(
                folder_path,
                None,
                IndexChange::RenameWithin {
                    from: from_rel,
                    to: to_rel.clone(),
                },
            ) {
                emit_updated(app, folder_str, stats);
            }
        }
        _ => {
            // Renamed in from outside (or unknown): treat as create
            if let Ok(meta) = to.metadata() {
                if meta.is_file() {
                    let info = FileInfo {
                        size: meta.len(),
                        mtime: meta.modified().unwrap_or(SystemTime::UNIX_EPOCH),
                    };
                    if let Some(stats) = cache.apply_delta(
                        folder_path,
                        Some(&to_rel),
                        IndexChange::Insert(info),
                    ) {
                        emit_updated(app, folder_str, stats);
                    }
                }
            }
        }
    }
}

pub fn register<R: Runtime>(app: AppHandle<R>, folder_path: &Path) -> Result<(), String> {
    let key = normalize(folder_path);
    {
        let watchers = WATCHERS.lock();
        if watchers.contains_key(&key) {
            return Ok(());
        }
    }

    let watch_path = key.clone();
    let app_handle = app.clone();
    let mut watcher = RecommendedWatcher::new(
        move |result: Result<Event, notify::Error>| match result {
            Ok(event) => handle_event(&app_handle, &watch_path, event),
            Err(err) => {
                tracing::info!(
                    "[folder-stats] watcher error for {}: {}",
                    watch_path.display(),
                    err
                );
                if let Some(cache) = folder_stats_cache::instance() {
                    cache.mark_dirty(&watch_path);
                }
            }
        },
        Config::default(),
    )
    .map_err(|err| format!("folder-stats watcher init failed: {err}"))?;

    if let Err(err) = watcher.watch(&key, RecursiveMode::Recursive) {
        return Err(format!("folder-stats watch failed: {err}"));
    }

    WATCHERS
        .lock()
        .insert(key, WatcherSlot { _watcher: watcher });
    Ok(())
}

pub fn unregister(folder_path: &Path) {
    let key = normalize(folder_path);
    WATCHERS.lock().remove(&key);
}

// Allow public emit from scan completion.
pub fn emit_for<R: Runtime>(app: &AppHandle<R>, folder_path: &str, stats: FolderStats) {
    emit_updated(app, folder_path, stats);
}

#[allow(dead_code)]
fn _arc_marker(_: Arc<folder_stats_cache::FolderStatsCache>) {}
