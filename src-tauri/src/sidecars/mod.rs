//! Sidecar management module.
//!
//! Each submodule owns the lifecycle of one external binary:
//! - [`llama_server`] – llama.cpp HTTP inference server (multi-slot)
//! - [`klin_worker`]  – Python FastAPI worker service
//!
//! Common helpers (e.g. `kill_sidecar`, `cleanup_all`) live here so
//! submodules can share them without circular imports.

pub mod klin_worker;
pub mod llama_server;

use std::sync::Arc;

use parking_lot::Mutex;
use tauri::Manager;
use tauri_plugin_shell::process::CommandChild;

// ── Re-exports for ergonomic use in lib.rs ─────────────────────────────

pub use klin_worker::spawn_klin_worker;
pub use llama_server::{
    ensure_slot_running, spawn_idle_timeout_task_for_slot, stop_slot, touch_slot_last_used,
    LlamaSlotState, ModelSlot,
};

// ── Shared utilities ───────────────────────────────────────────────────

/// Kill a sidecar whose `CommandChild` is stored in `child_slot`.
/// Logs the result and leaves the slot empty.
pub(crate) fn kill_sidecar(name: &str, child_slot: &Arc<Mutex<Option<CommandChild>>>) {
    if let Some(child) = child_slot.lock().take() {
        match child.kill() {
            Ok(_) => eprintln!("[shutdown] {} stopped", name),
            Err(e) => eprintln!("[shutdown] {} kill failed: {}", name, e),
        }
    }
}

/// Stop all sidecars; called from the Tauri `ExitRequested` / `Exit` handler.
pub fn cleanup_all<R: tauri::Runtime>(app: &tauri::AppHandle<R>) {
    let state = app.state::<crate::AppState>();
    for slot_state in state.slots.values() {
        kill_sidecar(
            &format!("llama-server[{}]", slot_state.slot.label()),
            &slot_state.child,
        );
    }
    kill_sidecar("klin-worker", &state.worker_child);
}
