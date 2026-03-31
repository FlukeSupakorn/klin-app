use tauri::State;

use crate::AppState;

#[tauri::command]
pub fn ensure_llama_server<R: tauri::Runtime>(
    app: tauri::AppHandle<R>,
    state: State<AppState>,
    slot: String,
) -> Result<(), String> {
    let model_slot = crate::sidecars::ModelSlot::from_str(&slot)?;
    crate::sidecars::ensure_slot_running(&app, state.slot(model_slot))
}

#[tauri::command]
pub fn stop_llama_server(state: State<AppState>, slot: String) -> Result<(), String> {
    let model_slot = crate::sidecars::ModelSlot::from_str(&slot)?;
    crate::sidecars::stop_slot(state.slot(model_slot));
    Ok(())
}

/// Refresh the idle timer whenever the frontend dispatches a request to
/// llama-server, preventing premature idle-timeout kills during long
/// operations (e.g. SSE streaming).
#[tauri::command]
pub fn touch_llama_server(state: State<AppState>, slot: String) -> Result<(), String> {
    let model_slot = crate::sidecars::ModelSlot::from_str(&slot)?;
    crate::sidecars::touch_slot_last_used(state.slot(model_slot));
    Ok(())
}

/// Eagerly warm up the Chat model at app startup.
/// The frontend should call this on app ready.
/// This will take 30-60 seconds on first run (model warmup).
#[tauri::command]
pub fn warmup_chat_model<R: tauri::Runtime>(
    app: tauri::AppHandle<R>,
    state: State<AppState>,
) -> Result<(), String> {
    let chat_slot = state.slot(crate::sidecars::ModelSlot::Chat);
    eprintln!("[startup] warming up Chat model (this may take 30-60 seconds)...");

    // Simply ensure Chat is running — blocks until warmup complete or fails
    crate::sidecars::ensure_slot_running(&app, chat_slot)?;
    eprintln!("[startup] Chat model ready!");

    Ok(())
}
