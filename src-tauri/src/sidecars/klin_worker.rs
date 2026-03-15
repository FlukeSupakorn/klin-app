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
                    eprintln!("[klin-worker] {}", String::from_utf8_lossy(&line));
                }
                CommandEvent::Stderr(line) => {
                    eprintln!(
                        "[klin-worker][stderr] {}",
                        String::from_utf8_lossy(&line)
                    );
                }
                CommandEvent::Terminated(payload) => {
                    eprintln!(
                        "[klin-worker] terminated (code: {:?}, signal: {:?})",
                        payload.code, payload.signal
                    );
                    break;
                }
                _ => {}
            }
        }
    });

    eprintln!("[klin-worker] Spawned — data_dir: {}", app_data_dir);

    Ok(child)
}
