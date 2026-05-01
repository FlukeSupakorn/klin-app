use std::path::PathBuf;

use crate::domain::dto::NoteFileEntryDto;

#[tauri::command]
pub fn save_note_file(
    folder_path: String,
    file_name: String,
    content: String,
) -> Result<String, String> {
    if folder_path.trim().is_empty() {
        return Err("Folder path is required".to_string());
    }

    let sanitized_name = file_name
        .chars()
        .map(|ch| match ch {
            '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*' => '-',
            _ => ch,
        })
        .collect::<String>();

    let final_name = if sanitized_name.trim().is_empty() {
        "Quick-Note"
    } else {
        sanitized_name.trim()
    };

    let full_path = PathBuf::from(folder_path).join(format!("{}.md", final_name));

    if let Some(parent) = full_path.parent() {
        std::fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }

    std::fs::write(&full_path, content).map_err(|error| error.to_string())?;

    Ok(full_path.to_string_lossy().to_string())
}

#[tauri::command]
pub fn list_note_files(folder_path: String) -> Result<Vec<NoteFileEntryDto>, String> {
    if folder_path.trim().is_empty() {
        return Err("Folder path is required".to_string());
    }

    let folder = PathBuf::from(folder_path);
    if !folder.exists() {
        return Ok(Vec::new());
    }

    let mut entries: Vec<NoteFileEntryDto> = std::fs::read_dir(folder)
        .map_err(|err| err.to_string())?
        .filter_map(Result::ok)
        .filter_map(|entry| {
            let path = entry.path();
            let extension = path.extension()?.to_string_lossy().to_ascii_lowercase();
            if extension != "md" {
                return None;
            }

            let metadata = entry.metadata().ok()?;
            let modified = metadata.modified().ok()?;
            let duration = modified.duration_since(std::time::UNIX_EPOCH).ok()?;

            Some(NoteFileEntryDto {
                path: path.to_string_lossy().to_string(),
                file_name: path
                    .file_name()
                    .map(|value| value.to_string_lossy().to_string())
                    .unwrap_or_else(|| "Untitled.md".to_string()),
                size_bytes: metadata.len(),
                last_modified_ms: duration.as_millis() as u64,
            })
        })
        .collect();

    entries.sort_by(|a, b| b.last_modified_ms.cmp(&a.last_modified_ms));
    Ok(entries)
}

#[tauri::command]
pub fn read_note_file(file_path: String) -> Result<String, String> {
    if file_path.trim().is_empty() {
        return Err("File path is required".to_string());
    }

    std::fs::read_to_string(file_path).map_err(|err| err.to_string())
}

#[tauri::command]
pub fn write_text_file(file_path: String, content: String) -> Result<(), String> {
    if file_path.trim().is_empty() {
        return Err("File path is required".to_string());
    }
    let path = PathBuf::from(&file_path);
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    std::fs::write(&path, content).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn stat_files(file_paths: Vec<String>) -> Vec<Option<NoteFileEntryDto>> {
    file_paths
        .into_iter()
        .map(|file_path| {
            let path = PathBuf::from(&file_path);
            let metadata = std::fs::metadata(&path).ok()?;
            let modified = metadata.modified().ok()?;
            let duration = modified.duration_since(std::time::UNIX_EPOCH).ok()?;
            let file_name = path
                .file_name()
                .map(|v| v.to_string_lossy().to_string())
                .unwrap_or_else(|| "Untitled.md".to_string());
            Some(NoteFileEntryDto {
                path: file_path,
                file_name,
                size_bytes: metadata.len(),
                last_modified_ms: duration.as_millis() as u64,
            })
        })
        .collect()
}
