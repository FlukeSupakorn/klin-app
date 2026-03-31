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

    for entry in fs::read_dir(&binaries_dir).into_iter().flatten().flatten() {
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()).map(|e| e.eq_ignore_ascii_case("dll")).unwrap_or(false) {
            if let Some(name) = path.file_name() {
                let _ = fs::copy(&path, target_dir.join(name));
            }
        }
    }
}

fn main() {
    copy_runtime_dlls();
    tauri_build::build()
}
