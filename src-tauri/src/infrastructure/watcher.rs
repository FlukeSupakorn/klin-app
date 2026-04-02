use notify::{Config, Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use once_cell::sync::Lazy;
use parking_lot::Mutex;
use serde::Serialize;
use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};
use std::thread;
use std::time::{Duration, Instant};
use tauri::Emitter;

static WATCHERS: Lazy<Mutex<Vec<RecommendedWatcher>>> = Lazy::new(|| Mutex::new(Vec::new()));
static WATCHED_PATHS: Lazy<Mutex<HashSet<String>>> = Lazy::new(|| Mutex::new(HashSet::new()));
static PENDING_PATHS: Lazy<Mutex<HashMap<String, Instant>>> =
    Lazy::new(|| Mutex::new(HashMap::new()));
static ACTIVE_CHECKS: Lazy<Mutex<HashSet<String>>> = Lazy::new(|| Mutex::new(HashSet::new()));
static LAST_EMITTED_AT: Lazy<Mutex<HashMap<String, Instant>>> =
    Lazy::new(|| Mutex::new(HashMap::new()));

const STABLE_QUIET_WINDOW: Duration = Duration::from_millis(500);
const STABLE_PROBE_GAP: Duration = Duration::from_millis(500);
const STABLE_PROBE_RETRIES: usize = 30;
const DUPLICATE_EMIT_WINDOW: Duration = Duration::from_secs(3);

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct WatchedFileEvent {
    file_path: String,
    folder_path: String,
}

fn should_emit(kind: &EventKind) -> bool {
    matches!(kind, EventKind::Create(_) | EventKind::Modify(_))
}

fn is_temporary_download_path(path: &str) -> bool {
    let lower = path.to_lowercase();
    [".crdownload", ".part", ".tmp", ".download"]
        .iter()
        .any(|suffix| lower.ends_with(suffix))
}

fn normalize_folder(path: &Path) -> String {
    path.to_string_lossy()
        .replace('/', "\\")
        .trim_end_matches('\\')
        .to_lowercase()
}

fn is_direct_child_of_watched_folder(path: &Path, watched_folder: &str) -> bool {
    let Some(parent) = path.parent() else {
        return false;
    };

    normalize_folder(parent) == normalize_folder(Path::new(watched_folder))
}

fn is_file_stable(path: &Path) -> bool {
    let Ok(metadata1) = std::fs::metadata(path) else {
        return false;
    };

    if !metadata1.is_file() {
        return false;
    }

    let size1 = metadata1.len();
    let modified1 = metadata1.modified().ok();

    thread::sleep(STABLE_PROBE_GAP);

    let Ok(metadata2) = std::fs::metadata(path) else {
        return false;
    };

    if !metadata2.is_file() {
        return false;
    }

    let size2 = metadata2.len();
    let modified2 = metadata2.modified().ok();

    size1 == size2 && modified1 == modified2
}

fn should_emit_now(path: &str) -> bool {
    let now = Instant::now();
    let mut emitted = LAST_EMITTED_AT.lock();
    if let Some(last) = emitted.get(path) {
        if now.duration_since(*last) < DUPLICATE_EMIT_WINDOW {
            return false;
        }
    }

    emitted.insert(path.to_string(), now);
    true
}

fn schedule_stability_check<R: tauri::Runtime>(
    app: tauri::AppHandle<R>,
    watched_folder: String,
    path: PathBuf,
) {
    let path_str = path.to_string_lossy().to_string();

    {
        let mut active = ACTIVE_CHECKS.lock();
        if active.contains(&path_str) {
            return;
        }
        active.insert(path_str.clone());
    }

    thread::spawn(move || {
        for _ in 0..STABLE_PROBE_RETRIES {
            thread::sleep(Duration::from_millis(200));

            let last_seen = {
                let pending = PENDING_PATHS.lock();
                pending.get(&path_str).copied()
            };

            let Some(last_seen) = last_seen else {
                break;
            };

            if Instant::now().duration_since(last_seen) < STABLE_QUIET_WINDOW {
                continue;
            }

            if is_temporary_download_path(&path_str) {
                break;
            }

            if is_file_stable(&path) {
                if should_emit_now(&path_str) {
                    tracing::info!("[watcher] file stable; emitting ready event: {}", path_str);

                    let payload = WatchedFileEvent {
                        file_path: path_str.clone(),
                        folder_path: watched_folder.clone(),
                    };
                    let _ = app.emit("watcher://file-created", payload);
                }
                break;
            }
        }

        PENDING_PATHS.lock().remove(&path_str);
        ACTIVE_CHECKS.lock().remove(&path_str);
    });
}

fn emit_file_events<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    watched_folder: &str,
    event: Event,
) {
    if !should_emit(&event.kind) {
        return;
    }

    for path in event.paths {
        // Some download/create events are delivered before metadata settles.
        // Only skip explicit directories; allow transient/nonexistent file paths.
        if path.is_dir() {
            continue;
        }

        if !is_direct_child_of_watched_folder(&path, watched_folder) {
            continue;
        }

        let path_str = path.to_string_lossy().to_string();
        if is_temporary_download_path(&path_str) {
            tracing::info!("[watcher] skip temporary download file: {}", path_str);
            continue;
        }

        tracing::info!(
            "[watcher] detected file event: kind={:?}, file={} (queued for stability check)",
            event.kind,
            path_str
        );

        PENDING_PATHS
            .lock()
            .insert(path_str.clone(), Instant::now());

        schedule_stability_check(
            app.clone(),
            watched_folder.to_string(),
            PathBuf::from(path_str),
        );
    }
}

pub fn watch_folder<R: tauri::Runtime>(
    app: tauri::AppHandle<R>,
    path: &Path,
) -> Result<(), String> {
    let folder_path = path.to_string_lossy().to_string();

    {
        let mut watched = WATCHED_PATHS.lock();
        if watched.contains(&folder_path) {
            tracing::info!("[watcher] already watching {}", folder_path);
            return Ok(());
        }
        watched.insert(folder_path.clone());
    }

    tracing::info!("[watcher] starting watch on {}", folder_path);

    let watched_folder = folder_path.clone();
    let app_handle = app.clone();
    let mut watcher = RecommendedWatcher::new(
        move |result| match result {
            Ok(event) => emit_file_events(&app_handle, &watched_folder, event),
            Err(err) => tracing::info!(
                "[watcher] file event error for '{}': {}",
                watched_folder,
                err
            ),
        },
        Config::default(),
    )
    .map_err(|err| format!("watcher init failed: {err}"))?;

    if let Err(err) = watcher.watch(path, RecursiveMode::NonRecursive) {
        WATCHED_PATHS.lock().remove(&folder_path);
        return Err(format!("watch folder failed: {err}"));
    }

    WATCHERS.lock().push(watcher);

    Ok(())
}
