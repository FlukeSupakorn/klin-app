use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::{Instant, SystemTime};

use once_cell::sync::OnceCell;
use parking_lot::Mutex;
use serde::{Deserialize, Serialize};

use crate::infrastructure::fs_ops::{FileInfo, FolderStats};

const SCHEMA_VERSION: u32 = 1;
const FLUSH_DEBOUNCE_MS: u128 = 5_000;
pub const FILE_INDEX_LIMIT: u64 = 500_000;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CacheEntry {
    pub schema_version: u32,
    pub file_count: u64,
    pub total_bytes: u64,
    #[serde(with = "ts_seconds")]
    pub computed_at: SystemTime,
    #[serde(default)]
    pub file_index: HashMap<String, FileInfo>,
    #[serde(default)]
    pub dirty: bool,
    #[serde(default)]
    pub file_index_dropped: bool,
}

mod ts_seconds {
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

impl CacheEntry {
    pub fn stats(&self) -> FolderStats {
        FolderStats {
            file_count: self.file_count,
            total_bytes: self.total_bytes,
        }
    }
}

#[derive(Debug, Default, Serialize, Deserialize)]
struct CacheFile {
    schema_version: u32,
    entries: HashMap<String, CacheEntry>,
}

pub struct FolderStatsCache {
    cache_path: PathBuf,
    inner: Mutex<HashMap<PathBuf, CacheEntry>>,
    last_flush: Mutex<Option<Instant>>,
}

static INSTANCE: OnceCell<Arc<FolderStatsCache>> = OnceCell::new();

pub fn init(app_data_dir: &Path) -> Arc<FolderStatsCache> {
    INSTANCE
        .get_or_init(|| Arc::new(FolderStatsCache::load(app_data_dir.join("folder-stats-cache.json"))))
        .clone()
}

pub fn instance() -> Option<Arc<FolderStatsCache>> {
    INSTANCE.get().cloned()
}

fn normalize_key(path: &Path) -> PathBuf {
    PathBuf::from(path.to_string_lossy().replace('/', "\\").trim_end_matches('\\'))
}

impl FolderStatsCache {
    fn load(path: PathBuf) -> Self {
        let inner = match std::fs::read_to_string(&path) {
            Ok(text) => match serde_json::from_str::<CacheFile>(&text) {
                Ok(f) if f.schema_version == SCHEMA_VERSION => f
                    .entries
                    .into_iter()
                    .map(|(k, v)| (PathBuf::from(k), v))
                    .collect(),
                _ => {
                    tracing::info!(
                        "[folder-stats] cache schema mismatch or unparsable; starting fresh"
                    );
                    HashMap::new()
                }
            },
            Err(_) => HashMap::new(),
        };

        Self {
            cache_path: path,
            inner: Mutex::new(inner),
            last_flush: Mutex::new(None),
        }
    }

    pub fn get(&self, path: &Path) -> Option<CacheEntry> {
        let key = normalize_key(path);
        self.inner.lock().get(&key).cloned()
    }

    pub fn put(&self, path: &Path, entry: CacheEntry) {
        let key = normalize_key(path);
        self.inner.lock().insert(key, entry);
        self.maybe_flush(false);
    }

    pub fn evict(&self, path: &Path) {
        let key = normalize_key(path);
        self.inner.lock().remove(&key);
        self.maybe_flush(false);
    }

    pub fn mark_dirty(&self, path: &Path) {
        let key = normalize_key(path);
        let mut guard = self.inner.lock();
        if let Some(entry) = guard.get_mut(&key) {
            entry.dirty = true;
        }
    }

    /// Apply a delta from a single FS event. Returns the updated stats if the
    /// folder is in the cache, or None if the folder isn't tracked.
    pub fn apply_delta(
        &self,
        folder: &Path,
        rel_path: Option<&str>,
        change: IndexChange,
    ) -> Option<FolderStats> {
        let key = normalize_key(folder);
        let mut guard = self.inner.lock();
        let entry = guard.get_mut(&key)?;

        match change {
            IndexChange::Insert(info) => {
                let added_bytes = info.size;
                if let Some(rel) = rel_path {
                    if !entry.file_index_dropped {
                        let prev = entry.file_index.insert(rel.to_string(), info);
                        if let Some(p) = prev {
                            // Replace: subtract old size, add new
                            entry.total_bytes = entry.total_bytes.saturating_sub(p.size);
                        } else {
                            entry.file_count = entry.file_count.saturating_add(1);
                        }
                    } else {
                        entry.dirty = true;
                        entry.file_count = entry.file_count.saturating_add(1);
                    }
                }
                entry.total_bytes = entry.total_bytes.saturating_add(added_bytes);
            }
            IndexChange::Modify(new_info) => {
                if let Some(rel) = rel_path {
                    if !entry.file_index_dropped {
                        if let Some(prev) = entry.file_index.get(rel).cloned() {
                            entry.total_bytes = entry.total_bytes.saturating_sub(prev.size);
                            entry.total_bytes = entry.total_bytes.saturating_add(new_info.size);
                            entry.file_index.insert(rel.to_string(), new_info);
                        } else {
                            // Unknown file: fall back to dirty
                            entry.dirty = true;
                        }
                    } else {
                        entry.dirty = true;
                    }
                }
            }
            IndexChange::Remove => {
                if let Some(rel) = rel_path {
                    if !entry.file_index_dropped {
                        if let Some(prev) = entry.file_index.remove(rel) {
                            entry.total_bytes = entry.total_bytes.saturating_sub(prev.size);
                            entry.file_count = entry.file_count.saturating_sub(1);
                        } else {
                            entry.dirty = true;
                        }
                    } else {
                        entry.dirty = true;
                    }
                }
            }
            IndexChange::RenameWithin { from, to } => {
                if !entry.file_index_dropped {
                    if let Some(info) = entry.file_index.remove(&from) {
                        entry.file_index.insert(to, info);
                    } else {
                        entry.dirty = true;
                    }
                }
            }
        }

        let stats = entry.stats();
        drop(guard);
        self.maybe_flush(false);
        Some(stats)
    }

    fn maybe_flush(&self, force: bool) {
        let mut last = self.last_flush.lock();
        let due = match *last {
            Some(t) => t.elapsed().as_millis() >= FLUSH_DEBOUNCE_MS,
            None => true,
        };
        if !force && !due {
            return;
        }
        *last = Some(Instant::now());
        drop(last);
        self.flush();
    }

    pub fn flush(&self) {
        let snapshot: HashMap<String, CacheEntry> = self
            .inner
            .lock()
            .iter()
            .map(|(k, v)| (k.to_string_lossy().to_string(), v.clone()))
            .collect();
        let file = CacheFile {
            schema_version: SCHEMA_VERSION,
            entries: snapshot,
        };
        let Ok(json) = serde_json::to_string(&file) else {
            return;
        };
        if let Some(parent) = self.cache_path.parent() {
            let _ = std::fs::create_dir_all(parent);
        }
        if let Err(err) = std::fs::write(&self.cache_path, json) {
            tracing::info!("[folder-stats] cache write failed: {}", err);
        }
    }
}

pub enum IndexChange {
    Insert(FileInfo),
    Modify(FileInfo),
    Remove,
    RenameWithin { from: String, to: String },
}

pub fn build_entry_from_walk(
    file_count: u64,
    total_bytes: u64,
    file_index: HashMap<String, FileInfo>,
) -> CacheEntry {
    let dropped = file_count > FILE_INDEX_LIMIT;
    CacheEntry {
        schema_version: SCHEMA_VERSION,
        file_count,
        total_bytes,
        computed_at: SystemTime::now(),
        file_index: if dropped { HashMap::new() } else { file_index },
        dirty: false,
        file_index_dropped: dropped,
    }
}

