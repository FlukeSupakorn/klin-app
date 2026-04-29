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
    tracing::info!("[startup] warming up Chat model (this may take 30-60 seconds)...");

    // Blocks until the HTTP /health endpoint returns 200.
    crate::sidecars::ensure_slot_running(&app, chat_slot)?;
    tracing::info!("[startup] Chat model server ready — priming inference engine...");

    // The first real /chat/completions call on a freshly-loaded model (especially
    // VL models like Qwen2.5-VL) often fails because the inference context and
    // KV-cache are not allocated until the first request hits them.  Send a
    // minimal test completion here, with up to 3 attempts, so the user's first
    // organize request is never the cold-start failure.
    for attempt in 0..3u32 {
        if crate::sidecars::prime_inference_engine(&chat_slot.slot) {
            tracing::info!("[startup] Chat inference engine primed and ready.");
            return Ok(());
        }
        if attempt < 2 {
            tracing::info!(
                "[startup] Inference prime attempt {} failed — retrying in 3s...",
                attempt + 1
            );
            std::thread::sleep(std::time::Duration::from_secs(3));
        }
    }

    // Three attempts failed.  Log a warning but don't error — the Tauri
    // health check passed so the server is up; the first user request may
    // still succeed depending on the model/platform.
    tracing::warn!("[startup] Inference engine priming failed after 3 attempts. First organize may fail.");
    Ok(())
}
