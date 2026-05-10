use std::sync::atomic::{AtomicBool, Ordering};

use tauri::Manager;

static PENDING_CLOSE_REQUEST: AtomicBool = AtomicBool::new(false);

pub fn mark_pending_close_request() {
    PENDING_CLOSE_REQUEST.store(true, Ordering::SeqCst);
}

#[tauri::command]
pub fn consume_pending_close_request() -> bool {
    PENDING_CLOSE_REQUEST.swap(false, Ordering::SeqCst)
}

#[tauri::command]
pub fn exit_app<R: tauri::Runtime>(app: tauri::AppHandle<R>) {
    app.exit(0);
}

#[tauri::command]
pub fn minimize_to_tray<R: tauri::Runtime>(app: tauri::AppHandle<R>) -> Result<(), String> {
    tracing::info!("[tray] minimize_to_tray requested");

    let window = app.get_webview_window("main").ok_or_else(|| {
        tracing::info!("[tray] minimize_to_tray failed: main window not found");
        "main window not found".to_string()
    })?;

    let result = window
        .hide()
        .map_err(|err| format!("failed to hide main window: {err}"));

    match &result {
        Ok(()) => tracing::info!("[tray] tray mode opened (main window hidden)"),
        Err(err) => tracing::info!("[tray] minimize_to_tray failed: {}", err),
    }

    result
}
