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
