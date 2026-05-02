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

    let actual_sha256 = format!("{:x}", hasher.finalize());
    if actual_sha256 != expected_sha256.to_ascii_lowercase() {
        let _ = fs::remove_file(&part_path);
        return Err(format!("SHA-256 mismatch for {slot}"));
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
pub fn get_system_specs() -> SystemSpecs {
    let mut system = sysinfo::System::new_all();
    system.refresh_memory();
    SystemSpecs {
        ram_total_bytes: system.total_memory(),
        ram_available_bytes: system.available_memory(),
        vram_bytes: None,
    }
}
