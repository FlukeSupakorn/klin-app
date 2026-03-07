use std::io::{Read, Write};
use std::net::TcpListener;
use std::path::PathBuf;

use serde::Serialize;
use tauri::{Emitter, State};

use crate::{
    dto::{CategoryDto, MoveFileDto, ReadFolderDto, SaveRuleMappingDto, WatchFolderDto, WriteLogDto},
    infrastructure::{app_paths, watcher},
    services::file_service::FileService,
    AppState,
};

#[tauri::command]
pub fn watch_folder(input: WatchFolderDto) -> Result<(), String> {
    watcher::watch_folder(PathBuf::from(input.folder_path).as_path())
}

#[tauri::command]
pub fn move_file(input: MoveFileDto) -> Result<(), String> {
    FileService::move_file(input.source_path, input.destination_path)
}

#[tauri::command]
pub fn read_folder(input: ReadFolderDto) -> Result<Vec<String>, String> {
    FileService::read_folder(input.folder_path)
}

#[tauri::command]
pub fn pick_files_for_organize() -> Result<Vec<String>, String> {
    let selected = rfd::FileDialog::new().pick_files();
    Ok(selected
        .unwrap_or_default()
        .into_iter()
        .map(|path| path.to_string_lossy().to_string())
        .collect())
}

#[tauri::command]
pub fn pick_folder_for_organize() -> Result<Option<String>, String> {
    let selected = rfd::FileDialog::new().pick_folder();
    Ok(selected.map(|path| path.to_string_lossy().to_string()))
}

#[tauri::command]
pub fn save_note_file(folder_path: String, file_name: String, content: String) -> Result<String, String> {
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
pub fn open_external_url(url: String) -> Result<(), String> {
    open::that(url).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn delete_file(file_path: String) -> Result<(), String> {
    FileService::delete_file(file_path)
}

#[tauri::command]
pub fn get_downloads_folder<R: tauri::Runtime>(app: tauri::AppHandle<R>) -> Result<String, String> {
    app_paths::resolve_downloads_dir(&app).map(|path| path.to_string_lossy().to_string())
}

#[derive(Serialize)]
pub struct NoteFileEntryDto {
    path: String,
    file_name: String,
    size_bytes: u64,
    last_modified_ms: u64,
}

#[tauri::command]
pub fn get_app_data_dir<R: tauri::Runtime>(app: tauri::AppHandle<R>) -> Result<String, String> {
    app_paths::resolve_app_data_dir(&app).map(|path| path.to_string_lossy().to_string())
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
pub fn write_log(state: State<AppState>, input: WriteLogDto) -> Result<(), String> {
    state.log_service.lock().write_log(input.log)
}

#[tauri::command]
pub fn list_logs(state: State<AppState>) -> Result<Vec<crate::domain::entities::AutomationLog>, String> {
    state.log_service.lock().list_logs()
}

#[tauri::command]
pub fn get_categories(state: State<AppState>) -> Result<Vec<CategoryDto>, String> {
    state
        .category_service
        .lock()
        .list_categories()
        .map(|categories| categories.into_iter().map(CategoryDto::from).collect())
}

#[tauri::command]
pub fn save_rule_mapping(state: State<AppState>, input: SaveRuleMappingDto) -> Result<(), String> {
    state.rule_service.lock().save_mappings(input.mappings)
}

const OAUTH_SUCCESS_HTML: &str = r#"HTTP/1.1 200 OK
Content-Type: text/html; charset=utf-8
Connection: close

<!DOCTYPE html>
<html>
<head><title>KLIN - Sign in</title></head>
<body style="font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#0f0f0f;color:#e5e5e5">
<div style="text-align:center"><h2>Authentication successful!</h2><p>You can close this tab and return to KLIN.</p></div>
</body>
</html>"#;

const OAUTH_ERROR_HTML: &str = r#"HTTP/1.1 200 OK
Content-Type: text/html; charset=utf-8
Connection: close

<!DOCTYPE html>
<html>
<head><title>KLIN - Sign in</title></head>
<body style="font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#0f0f0f;color:#e5e5e5">
<div style="text-align:center"><h2>Authentication failed</h2><p>No authorization code received. Please try again.</p></div>
</body>
</html>"#;

#[tauri::command]
pub fn start_oauth_listener(app: tauri::AppHandle) -> Result<(), String> {
    if let Ok(mut old) = std::net::TcpStream::connect_timeout(
        &"127.0.0.1:17920".parse().unwrap(),
        std::time::Duration::from_millis(50),
    ) {
        let _ = std::io::Write::write_all(&mut old, b"GET /cancel HTTP/1.1\r\n\r\n");
        drop(old);
        std::thread::sleep(std::time::Duration::from_millis(200));
    }

    let listener = TcpListener::bind("127.0.0.1:17920").map_err(|e| {
        if e.kind() == std::io::ErrorKind::AddrInUse {
            "OAuth port 17920 is busy. Please wait a moment and try again.".to_string()
        } else {
            e.to_string()
        }
    })?;

    listener
        .set_nonblocking(false)
        .map_err(|e| e.to_string())?;

    std::thread::spawn(move || {
        let _ = listener.set_nonblocking(false);
        let timeout = std::time::Duration::from_secs(120);
        let start = std::time::Instant::now();

        loop {
            if start.elapsed() > timeout {
                let _ = app.emit("oauth-callback-code", String::new());
                return;
            }

            let _ = listener.set_nonblocking(true);
            match listener.accept() {
                Ok((mut stream, _)) => {
                    let _ = stream.set_read_timeout(Some(std::time::Duration::from_secs(5)));
                    let mut buf = vec![0u8; 8192];
                    let n = stream.read(&mut buf).unwrap_or(0);
                    let request = String::from_utf8_lossy(&buf[..n]);

                    if let Some(first_line) = request.lines().next() {
                        let path = first_line
                            .strip_prefix("GET ")
                            .and_then(|rest| rest.split_whitespace().next())
                            .unwrap_or("");

                        let query_start = path.find('?');
                        if let Some(qi) = query_start {
                            let query = &path[qi + 1..];
                            let code = query
                                .split('&')
                                .filter_map(|pair| pair.split_once('='))
                                .find(|(k, _)| *k == "code")
                                .map(|(_, v)| v.to_string());

                            if let Some(auth_code) = code {
                                let _ = stream.write_all(OAUTH_SUCCESS_HTML.as_bytes());
                                let _ = stream.flush();
                                drop(stream);
                                let _ = app.emit("oauth-callback-code", auth_code);
                            } else {
                                let _ = stream.write_all(OAUTH_ERROR_HTML.as_bytes());
                                let _ = stream.flush();
                                drop(stream);
                                let _ = app.emit("oauth-callback-code", String::new());
                            }
                        } else {
                            let _ = stream.write_all(b"HTTP/1.1 204 No Content\r\n\r\n");
                            let _ = stream.flush();
                            drop(stream);
                            continue;
                        }
                    }
                    return;
                }
                Err(ref e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                    std::thread::sleep(std::time::Duration::from_millis(100));
                    continue;
                }
                Err(_) => {
                    let _ = app.emit("oauth-callback-code", String::new());
                    return;
                }
            }
        }
    });

    Ok(())
}
