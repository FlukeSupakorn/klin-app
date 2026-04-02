use tauri::Manager;

#[tauri::command]
pub fn exit_app<R: tauri::Runtime>(app: tauri::AppHandle<R>) {
    app.exit(0);
}

#[tauri::command]
pub fn minimize_to_tray<R: tauri::Runtime>(app: tauri::AppHandle<R>) -> Result<(), String> {
    eprintln!("[tray] minimize_to_tray requested");

    let window = app
        .get_webview_window("main")
        .ok_or_else(|| {
            eprintln!("[tray] minimize_to_tray failed: main window not found");
            "main window not found".to_string()
        })?;

    let result = window
        .hide()
        .map_err(|err| format!("failed to hide main window: {err}"));

    match &result {
        Ok(()) => eprintln!("[tray] tray mode opened (main window hidden)"),
        Err(err) => eprintln!("[tray] minimize_to_tray failed: {}", err),
    }

    result
}
