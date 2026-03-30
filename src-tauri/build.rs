use std::env;
use std::fs;
use std::path::{Path, PathBuf};

fn copy_runtime_dlls() {
    let manifest_dir =
        PathBuf::from(env::var("CARGO_MANIFEST_DIR").expect("CARGO_MANIFEST_DIR missing"));
    let binaries_dir = manifest_dir.join("binaries");
    let profile = env::var("PROFILE").expect("PROFILE missing");
    let target_dir = manifest_dir.join("target").join(profile);

    println!("cargo:rerun-if-changed={}", binaries_dir.display());

    if !binaries_dir.exists() || !target_dir.exists() {
        return;
    }

    let entries = match fs::read_dir(&binaries_dir) {
        Ok(entries) => entries,
        Err(_) => return,
    };

    for entry in entries.flatten() {
        let path = entry.path();
        if !is_dll(&path) {
            continue;
        }

        let file_name = match path.file_name() {
            Some(name) => name,
            None => continue,
        };

        let destination = target_dir.join(file_name);
        let _ = fs::copy(&path, destination);
    }
}

fn is_dll(path: &Path) -> bool {
    path.extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| ext.eq_ignore_ascii_case("dll"))
        .unwrap_or(false)
}

fn main() {
    copy_runtime_dlls();
    tauri_build::build()
}
