use std::{
    collections::{HashMap, HashSet},
    fs,
    io::Write,
    path::{Path, PathBuf},
    sync::Mutex,
    time::Duration,
};

use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use tauri::Emitter;

use crate::AppState;

static CANCELLED_SLOTS: Lazy<Mutex<HashSet<String>>> = Lazy::new(|| Mutex::new(HashSet::new()));

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelConfigEntry {
    pub filename: String,
    pub sha256: String,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelConfig {
    pub models: HashMap<String, ModelConfigEntry>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InstalledModel {
    pub filename: String,
    pub path: String,
    pub size_bytes: u64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelDownloadProgress {
    pub slot: String,
    pub downloaded: u64,
    pub total: u64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HfModelMetadata {
    pub sha256: String,
    pub size: u64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemSpecs {
    pub ram_total_bytes: u64,
    pub ram_available_bytes: u64,
    pub vram_bytes: Option<u64>,
}

fn model_dir(app_data_dir: &Path) -> PathBuf {
    app_data_dir.join("models")
}

fn model_config_path(app_data_dir: &Path) -> PathBuf {
    app_data_dir.join("model_config.json")
}

fn ensure_model_dir(app_data_dir: &Path) -> Result<PathBuf, String> {
    let dir = model_dir(app_data_dir);
    fs::create_dir_all(&dir).map_err(|error| error.to_string())?;
    Ok(dir)
}

fn read_config_from_path(path: &Path) -> Result<ModelConfig, String> {
    if !path.exists() {
        return Ok(ModelConfig::default());
    }

    let json = fs::read_to_string(path).map_err(|error| error.to_string())?;
    serde_json::from_str::<ModelConfig>(&json).map_err(|error| error.to_string())
}

fn is_cancelled(slot: &str) -> bool {
    CANCELLED_SLOTS
        .lock()
        .map(|slots| slots.contains(slot))
        .unwrap_or(false)
}

fn clear_cancelled(slot: &str) {
    if let Ok(mut slots) = CANCELLED_SLOTS.lock() {
        slots.remove(slot);
    }
}

fn emit_progress<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    slot: &str,
    downloaded: u64,
    total: u64,
) -> Result<(), String> {
    app.emit(
        "model-download://progress",
        ModelDownloadProgress {
            slot: slot.to_string(),
            downloaded,
            total,
        },
    )
    .map_err(|error| error.to_string())
}

fn dry_run_enabled() -> bool {
    cfg!(debug_assertions)
        || std::env::var("KLIN_DEV_DRY_RUN_DOWNLOAD")
            .map(|value| value.trim() == "1")
            .unwrap_or(false)
}

async fn dry_run_download<R: tauri::Runtime>(
    app: tauri::AppHandle<R>,
    url: String,
    dest_path: PathBuf,
    slot: String,
    expected_size: u64,
) -> Result<(), String> {
    tracing::info!(
        "[model-download][dev] would download {} → {}",
        url,
        dest_path.display()
    );

    let total = expected_size.max(8);
    for step in 1..=8 {
        if is_cancelled(&slot) {
            return Err(format!("download cancelled for {slot}"));
        }
        std::thread::sleep(Duration::from_millis(250));
        emit_progress(&app, &slot, total * step / 8, total)?;
    }

    fs::write(&dest_path, b"KLIN_MODEL_STUB!").map_err(|error| error.to_string())?;
    Ok(())
}

async fn real_download<R: tauri::Runtime>(
    app: tauri::AppHandle<R>,
    url: String,
    dest_path: PathBuf,
    slot: String,
    expected_sha256: String,
    expected_size: u64,
) -> Result<(), String> {
    let part_path = dest_path.with_extension("part");
    if part_path.exists() {
        fs::remove_file(&part_path).map_err(|error| error.to_string())?;
    }
    let bad_path = dest_path.with_extension("gguf.bad");
    if bad_path.exists() {
        let _ = fs::remove_file(&bad_path);
    }

    let response = reqwest::get(&url).await.map_err(|error| error.to_string())?;
    if !response.status().is_success() {
        return Err(format!(
            "download failed for {slot}: HTTP {}",
            response.status()
        ));
    }

    let total = response.content_length().unwrap_or(expected_size);
    let mut file = fs::File::create(&part_path).map_err(|error| error.to_string())?;
    let mut hasher = Sha256::new();
    let mut downloaded = 0_u64;
    let mut response = response;

    while let Some(chunk) = response.chunk().await.map_err(|error| error.to_string())? {
        if is_cancelled(&slot) {
            let _ = fs::remove_file(&part_path);
            return Err(format!("download cancelled for {slot}"));
        }

        file.write_all(&chunk).map_err(|error| error.to_string())?;
        hasher.update(&chunk);
        downloaded += chunk.len() as u64;
        emit_progress(&app, &slot, downloaded, total)?;
    }

    file.flush().map_err(|error| error.to_string())?;
    drop(file);

    let actual_sha256 = format!("{:x}", hasher.finalize());
    let expected_lc = expected_sha256.to_ascii_lowercase();
    if actual_sha256 != expected_lc {
        if let Err(rename_err) = fs::rename(&part_path, &bad_path) {
            tracing::warn!(
                "[model-download] could not rename {} -> {}: {}",
                part_path.display(),
                bad_path.display(),
                rename_err
            );
            let _ = fs::remove_file(&part_path);
            return Err(format!(
                "SHA-256 mismatch for {slot}: expected {expected_lc}, got {actual_sha256}"
            ));
        }
        return Err(format!(
            "SHA-256 mismatch for {slot}: expected {expected_lc}, got {actual_sha256}. Saved bad copy at {}",
            bad_path.display()
        ));
    }

    fs::rename(&part_path, &dest_path).map_err(|error| error.to_string())?;
    emit_progress(&app, &slot, total, total)?;
    Ok(())
}

#[tauri::command]
pub async fn download_model<R: tauri::Runtime>(
    app: tauri::AppHandle<R>,
    state: tauri::State<'_, AppState>,
    url: String,
    dest_filename: String,
    slot: String,
    expected_sha256: String,
    expected_size: u64,
) -> Result<(), String> {
    clear_cancelled(&slot);
    let filename = Path::new(&dest_filename)
        .file_name()
        .ok_or_else(|| "Model filename is required".to_string())?
        .to_string_lossy()
        .to_string();
    let dir = ensure_model_dir(&state.app_data_dir)?;
    let dest_path = dir.join(filename);

    if dry_run_enabled() {
        dry_run_download(app, url, dest_path, slot, expected_size).await
    } else {
        real_download(app, url, dest_path, slot, expected_sha256, expected_size).await
    }
}

#[tauri::command]
pub fn cancel_model_download(slot: String) -> Result<(), String> {
    CANCELLED_SLOTS
        .lock()
        .map_err(|error| error.to_string())?
        .insert(slot);
    Ok(())
}

#[tauri::command]
pub fn get_model_dir(state: tauri::State<'_, AppState>) -> Result<String, String> {
    ensure_model_dir(&state.app_data_dir).map(|path| path.to_string_lossy().to_string())
}

#[tauri::command]
pub fn read_model_config(state: tauri::State<'_, AppState>) -> Result<ModelConfig, String> {
    read_config_from_path(&model_config_path(&state.app_data_dir))
}

#[tauri::command]
pub fn write_model_config(
    state: tauri::State<'_, AppState>,
    slot: String,
    filename: String,
    sha256: String,
) -> Result<ModelConfig, String> {
    let path = model_config_path(&state.app_data_dir);
    let mut config = read_config_from_path(&path)?;
    config
        .models
        .insert(slot, ModelConfigEntry { filename, sha256 });

    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }

    let json = serde_json::to_string_pretty(&config).map_err(|error| error.to_string())?;
    fs::write(&path, json).map_err(|error| error.to_string())?;
    Ok(config)
}

#[tauri::command]
pub fn list_installed_models(
    state: tauri::State<'_, AppState>,
) -> Result<Vec<InstalledModel>, String> {
    let dir = ensure_model_dir(&state.app_data_dir)?;
    let mut entries: Vec<InstalledModel> = fs::read_dir(dir)
        .map_err(|error| error.to_string())?
        .filter_map(Result::ok)
        .filter_map(|entry| {
            let path = entry.path();
            let filename = path.file_name()?.to_string_lossy().to_string();
            let lower = filename.to_ascii_lowercase();
            if !lower.ends_with(".gguf") {
                return None;
            }

            let metadata = entry.metadata().ok()?;
            Some(InstalledModel {
                filename,
                path: path.to_string_lossy().to_string(),
                size_bytes: metadata.len(),
            })
        })
        .collect();

    entries.sort_by(|a, b| a.filename.cmp(&b.filename));
    Ok(entries)
}

#[tauri::command]
pub fn delete_installed_model(
    state: tauri::State<'_, AppState>,
    filename: String,
) -> Result<(), String> {
    // Hardening: refuse anything that isn't a plain .gguf basename. No path
    // separators, no traversal, no other extensions. The model dir is the
    // only legal location.
    let trimmed = filename.trim();
    if trimmed.is_empty() {
        return Err("filename must not be empty".into());
    }
    if trimmed.contains('/') || trimmed.contains('\\') || trimmed.contains("..") {
        return Err("invalid filename".into());
    }
    if !trimmed.to_ascii_lowercase().ends_with(".gguf") {
        return Err("only .gguf files can be deleted via this command".into());
    }

    let dir = ensure_model_dir(&state.app_data_dir)?;
    let target = dir.join(trimmed);

    // Belt-and-braces: the resolved path must still live under the model dir.
    let canon_dir = dir.canonicalize().unwrap_or(dir.clone());
    let canon_target = target.canonicalize().unwrap_or_else(|_| target.clone());
    if !canon_target.starts_with(&canon_dir) {
        return Err("refusing to delete file outside model directory".into());
    }

    if !canon_target.exists() {
        // Nothing to delete is success — keeps the UI optimistic flow simple.
        return Ok(());
    }

    fs::remove_file(&canon_target).map_err(|error| error.to_string())?;
    tracing::info!("[models] deleted {}", canon_target.display());
    Ok(())
}

/// Parse "https://huggingface.co/<owner>/<repo>/resolve/<rev>/<path...>"
/// into ("<owner>/<repo>", "<path...>").
fn parse_hf_resolve_url(url: &str) -> Result<(String, String), String> {
    let prefix = "https://huggingface.co/";
    let rest = url
        .strip_prefix(prefix)
        .ok_or_else(|| format!("not a huggingface.co URL: {url}"))?;
    let (repo_part, rest) = rest
        .split_once("/resolve/")
        .ok_or_else(|| format!("missing /resolve/ in URL: {url}"))?;
    let (_revision, file_path) = rest
        .split_once('/')
        .ok_or_else(|| format!("missing file path after revision in URL: {url}"))?;
    Ok((repo_part.to_string(), file_path.to_string()))
}

#[tauri::command]
pub async fn resolve_hf_model_metadata(url: String) -> Result<HfModelMetadata, String> {
    let (repo, file_path) = parse_hf_resolve_url(&url)?;
    let api_url = format!("https://huggingface.co/api/models/{repo}/tree/main");

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(15))
        .build()
        .map_err(|e| e.to_string())?;
    let response = client
        .get(&api_url)
        .send()
        .await
        .map_err(|e| format!("HF API request failed: {e}"))?;
    if !response.status().is_success() {
        return Err(format!("HF API HTTP {} for {api_url}", response.status()));
    }
    let body = response
        .text()
        .await
        .map_err(|e| format!("HF API read failed: {e}"))?;
    let entries: Vec<serde_json::Value> = serde_json::from_str(&body)
        .map_err(|e| format!("HF API JSON parse failed: {e}"))?;

    let entry = entries
        .iter()
        .find(|e| e.get("path").and_then(|v| v.as_str()) == Some(file_path.as_str()))
        .ok_or_else(|| format!("file {file_path} not found in repo {repo}"))?;

    let lfs = entry
        .get("lfs")
        .ok_or_else(|| format!("file {file_path} has no LFS metadata (not an LFS file?)"))?;
    let sha256 = lfs
        .get("oid")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "missing lfs.oid in HF API response".to_string())?
        .to_ascii_lowercase();
    let size = lfs
        .get("size")
        .and_then(|v| v.as_u64())
        .ok_or_else(|| "missing lfs.size in HF API response".to_string())?;

    Ok(HfModelMetadata { sha256, size })
}

#[tauri::command]
pub fn get_system_specs() -> SystemSpecs {
    let mut system = sysinfo::System::new_all();
    system.refresh_memory();
    SystemSpecs {
        ram_total_bytes: system.total_memory(),
        ram_available_bytes: system.available_memory(),
        vram_bytes: None,
    }
}
