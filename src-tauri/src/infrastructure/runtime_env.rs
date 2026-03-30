use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::OnceLock;

static APP_ENV: OnceLock<HashMap<String, String>> = OnceLock::new();

fn app_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .map(Path::to_path_buf)
        .unwrap_or_else(|| PathBuf::from("."))
}

fn app_env_path() -> PathBuf {
    app_root().join(".env")
}

fn parse_env_value(raw: &str) -> String {
    let trimmed = raw.trim();
    if trimmed.len() >= 2 {
        let bytes = trimmed.as_bytes();
        let first = bytes[0];
        let last = bytes[trimmed.len() - 1];
        if (first == b'"' && last == b'"') || (first == b'\'' && last == b'\'') {
            return trimmed[1..trimmed.len() - 1].to_string();
        }
    }
    trimmed.to_string()
}

fn load_env_map() -> HashMap<String, String> {
    let path = app_env_path();
    let Ok(contents) = fs::read_to_string(&path) else {
        eprintln!("[startup] env file not found: {}", path.display());
        return HashMap::new();
    };

    let mut env = HashMap::new();
    for (index, line) in contents.lines().enumerate() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with('#') {
            continue;
        }

        let Some((key, value)) = trimmed.split_once('=') else {
            eprintln!(
                "[startup] skipping malformed env line {} in {}: {}",
                index + 1,
                path.display(),
                trimmed
            );
            continue;
        };

        let key = key.trim();
        if key.is_empty() {
            eprintln!(
                "[startup] skipping env line {} with empty key in {}",
                index + 1,
                path.display()
            );
            continue;
        }

        env.insert(key.to_string(), parse_env_value(value));
    }

    env
}

fn env_map() -> &'static HashMap<String, String> {
    APP_ENV.get_or_init(load_env_map)
}

fn models_dir() -> PathBuf {
    app_root().join("models")
}

fn find_model_path<F>(predicate: F) -> Option<String>
where
    F: Fn(&str) -> bool,
{
    let dir = models_dir();
    let entries = fs::read_dir(dir).ok()?;
    for entry in entries.flatten() {
        let path = entry.path();
        let file_name = path.file_name()?.to_string_lossy().to_string();
        if predicate(&file_name) {
            return Some(path.display().to_string());
        }
    }
    None
}

fn fallback_model_path(name: &str) -> Option<String> {
    match name {
        "KLIN_EMBED_MODEL_PATH" => find_model_path(|file_name| {
            let lower = file_name.to_ascii_lowercase();
            lower.ends_with(".gguf") && lower.contains("embed")
        }),
        "KLIN_CHAT_MODEL_PATH" | "KLIN_MODEL_PATH" => find_model_path(|file_name| {
            let lower = file_name.to_ascii_lowercase();
            lower.ends_with(".gguf") && !lower.contains("embed")
        }),
        "KLIN_MMPROJ_PATH" => find_model_path(|file_name| {
            let lower = file_name.to_ascii_lowercase();
            lower.ends_with(".gguf") && lower.contains("mmproj")
        }),
        _ => None,
    }
}

pub fn app_env_path_string() -> String {
    app_env_path().display().to_string()
}

pub fn preload_process_env() -> bool {
    let env = env_map();
    !env.is_empty()
}

pub fn get(name: &str) -> Option<String> {
    std::env::var(name)
        .ok()
        .filter(|value| !value.trim().is_empty())
        .or_else(|| env_map().get(name).cloned().filter(|value| !value.trim().is_empty()))
        .or_else(|| fallback_model_path(name))
}

pub fn get_or(name: &str, fallback: &str) -> String {
    get(name).unwrap_or_else(|| fallback.to_string())
}

pub fn get_bool(name: &str) -> bool {
    get(name)
        .map(|value| {
            matches!(
                value.trim().to_ascii_lowercase().as_str(),
                "1" | "true" | "yes" | "on"
            )
        })
        .unwrap_or(false)
}
