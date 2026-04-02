use tauri::Manager;

#[tauri::command]
pub fn exit_app<R: tauri::Runtime>(app: tauri::AppHandle<R>) {
    app.exit(0);
}

#[tauri::command]
pub fn minimize_to_tray<R: tauri::Runtime>(app: tauri::AppHandle<R>) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "main window not found".to_string())?;

    window
        .hide()
        .map_err(|err| format!("failed to hide main window: {err}"))
}
