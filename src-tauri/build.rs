use std::env;
use std::fs;
use std::path::PathBuf;

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

    // Copy DLLs and binaries from binaries/ to target/ (silently skip if locked)
    if let Ok(entries) = fs::read_dir(&binaries_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if let Some(name) = path.file_name() {
                let target_path = target_dir.join(name);
                // Silently skip if file is locked (in use by running process)
                let _ = fs::copy(&path, target_path);
            }
        }
    }
}

fn main() {
    copy_runtime_dlls();
    tauri_build::build()
}
