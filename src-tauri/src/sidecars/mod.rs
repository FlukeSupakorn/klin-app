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
use std::thread;
use std::time::Duration;

use parking_lot::Mutex;
use tauri::Manager;
use tauri_plugin_shell::process::CommandChild;

// ── Re-exports for ergonomic use in lib.rs ─────────────────────────────

pub use klin_worker::spawn_klin_worker;
pub use llama_server::{
    ensure_slot_running, prime_inference_engine, spawn_idle_timeout_task_for_slot, stop_slot,
    touch_slot_last_used, LlamaSlotState, ModelSlot,
};

// ── Shared utilities ───────────────────────────────────────────────────

/// Kill a sidecar whose `CommandChild` is stored in `child_slot`.
/// Logs the result and leaves the slot empty.
/// On Windows, uses taskkill as fallback if normal kill fails.
pub(crate) fn kill_sidecar(name: &str, child_slot: &Arc<Mutex<Option<CommandChild>>>) {
    let Some(child) = child_slot.lock().take() else { return };

    #[cfg(target_os = "windows")]
    {
        let pid = child.pid();
        use std::process::Command;

        // Try graceful exit first: child.kill() sends a normal terminate signal
        // to the top-level process. Many sidecars (uvicorn, llama-server) can
        // shut down cleanly within a short window.
        tracing::info!("[shutdown] {} requesting graceful exit (PID: {})", name, pid);
        let _ = child.kill();

        // Brief grace window, then escalate to taskkill /T which also reaps
        // child processes (e.g. uvicorn workers) that survive a soft kill.
        thread::sleep(Duration::from_millis(800));

        tracing::info!("[shutdown] {} force-killing process tree (PID: {})", name, pid);
        let _ = Command::new("taskkill")
            .args(&["/PID", &pid.to_string(), "/F", "/T"])
            .output();
    }

    #[cfg(not(target_os = "windows"))]
    {
        match child.kill() {
            Ok(_) => tracing::info!("[shutdown] {} terminated", name),
            Err(e) => tracing::info!("[shutdown] {} kill failed: {}", name, e),
        }
    }
}

/// Stop all sidecars in parallel; called from the Tauri `ExitRequested` / `Exit` handler.
pub fn cleanup_all<R: tauri::Runtime>(app: &tauri::AppHandle<R>) {
    let state = app.state::<crate::AppState>();
    let mut handles = Vec::new();

    for slot_state in state.slots.values() {
        let name = format!("llama-server[{}]", slot_state.slot.label());
        let child = slot_state.child.clone();
        handles.push(thread::spawn(move || kill_sidecar(&name, &child)));
    }

    let worker = state.worker_child.clone();
    handles.push(thread::spawn(move || kill_sidecar("klin-worker", &worker)));

    for h in handles {
        let _ = h.join();
    }
}
