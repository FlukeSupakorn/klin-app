use notify::{Config, RecommendedWatcher, RecursiveMode, Watcher};
use once_cell::sync::Lazy;
use parking_lot::Mutex;
use std::path::Path;

static WATCHERS: Lazy<Mutex<Vec<RecommendedWatcher>>> = Lazy::new(|| Mutex::new(Vec::new()));

pub fn watch_folder(path: &Path) -> Result<(), String> {
    let mut watcher = RecommendedWatcher::new(|_| {}, Config::default())
        .map_err(|err| format!("watcher init failed: {err}"))?;

    watcher
        .watch(path, RecursiveMode::Recursive)
        .map_err(|err| format!("watch folder failed: {err}"))?;

    WATCHERS.lock().push(watcher);

    Ok(())
}
