use std::path::Path;

pub fn move_file(source: &Path, destination: &Path) -> Result<(), String> {
    if let Some(parent) = destination.parent() {
        std::fs::create_dir_all(parent).map_err(|err| format!("create destination parent failed: {err}"))?;
    }
    std::fs::rename(source, destination).map_err(|err| format!("move file failed: {err}"))
}

pub fn read_folder(folder: &Path) -> Result<Vec<String>, String> {
    let entries = std::fs::read_dir(folder).map_err(|err| format!("read folder failed: {err}"))?;
    let mut files = Vec::new();
    for entry in entries {
        let entry = entry.map_err(|err| format!("read entry failed: {err}"))?;
        let path = entry.path();
        if path.is_file() {
            files.push(path.to_string_lossy().to_string());
        }
    }
    Ok(files)
}

pub fn delete_file(path: &Path) -> Result<(), String> {
    std::fs::remove_file(path).map_err(|err| format!("delete file failed: {err}"))
}
