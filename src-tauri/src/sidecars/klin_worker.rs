use tauri_plugin_shell::process::{CommandChild, CommandEvent};
use tauri_plugin_shell::ShellExt;

/// Spawn the klin-worker sidecar as a long-running background service.
pub fn spawn_klin_worker<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    app_data_dir: &str,
) -> Result<CommandChild, String> {
    let sidecar_cmd = app
        .shell()
        .sidecar("klin-worker")
        .map_err(|e| format!("Failed to create klin-worker sidecar: {e}"))?
        .env("KLIN_APP_DATA_DIR", app_data_dir)
        .env("KLIN_APP_ENVIRONMENT", "production")
        .env("KLIN_LANGFUSE_ENABLED", "true")
        .env(
            "KLIN_LANGFUSE_PUBLIC_KEY",
            "pk-lf-b7f3cf9c-e0e6-4c98-8db2-0871556aef8e",
        )
        .env(
            "KLIN_LANGFUSE_SECRET_KEY",
            "sk-lf-c6ccd8cd-7b23-4b30-9cc8-400694ba2fcf",
        )
        .env("KLIN_LANGFUSE_HOST", "http://localhost:3000")
        .args([
            "--host",
            "127.0.0.1",
            "--port",
            "8000",
            "--data-dir",
            app_data_dir,
        ]);

    let (mut rx, child) = sidecar_cmd
        .spawn()
        .map_err(|e| format!("Failed to spawn klin-worker: {e}"))?;

    tauri::async_runtime::spawn(async move {
        while let Some(event) = rx.recv().await {
            match event {
                CommandEvent::Stdout(line) => {
                    tracing::info!("[klin-worker] {}", String::from_utf8_lossy(&line));
                }
                CommandEvent::Stderr(line) => {
                    tracing::info!("[klin-worker][stderr] {}", String::from_utf8_lossy(&line));
                }
                CommandEvent::Terminated(payload) => {
                    tracing::info!(
                        "[klin-worker] terminated (code: {:?}, signal: {:?})",
                        payload.code,
                        payload.signal
                    );
                    break;
                }
                _ => {}
            }
        }
    });

    tracing::info!("[klin-worker] Spawned — data_dir: {}", app_data_dir);

    Ok(child)
}
