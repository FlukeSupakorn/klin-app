use std::net::{SocketAddr, TcpStream};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};

use parking_lot::Mutex;
use tauri_plugin_shell::process::{CommandChild, CommandEvent};
use tauri_plugin_shell::ShellExt;

use crate::AppState;

// ── Port / address helpers ─────────────────────────────────────────────

pub fn llama_port() -> u16 {
    std::env::var("KLIN_LLAMA_PORT")
        .ok()
        .and_then(|v| v.parse::<u16>().ok())
        .unwrap_or(8080)
}

pub fn llama_socket_addr() -> SocketAddr {
    SocketAddr::from(([127, 0, 0, 1], llama_port()))
}

// ── Readiness probe ────────────────────────────────────────────────────

pub fn is_llama_server_ready() -> bool {
    TcpStream::connect_timeout(&llama_socket_addr(), Duration::from_millis(250)).is_ok()
}

pub fn wait_for_llama_server_ready(
    timeout: Duration,
    is_alive: &Arc<AtomicBool>,
) -> Result<(), String> {
    let started_at = Instant::now();

    while started_at.elapsed() < timeout {
        if !is_alive.load(Ordering::SeqCst) {
            return Err("llama-server sidecar crashed or exited immediately".to_string());
        }

        if is_llama_server_ready() {
            return Ok(());
        }

        std::thread::sleep(Duration::from_millis(250));
    }

    Err(format!(
        "Timed out waiting for llama-server to listen on {}",
        llama_socket_addr()
    ))
}

// ── Spawn ──────────────────────────────────────────────────────────────

/// Spawn the llama-server sidecar.
/// Returns the `CommandChild` handle and a liveness flag.
pub fn spawn_llama_server<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
) -> Result<(CommandChild, Arc<AtomicBool>), String> {
    let model_path = std::env::var("KLIN_MODEL_PATH").unwrap_or_default();

    if model_path.is_empty() {
        return Err(
            "KLIN_MODEL_PATH not set in .env — skipping llama-server.".to_string(),
        );
    }

    let n_gpu_layers =
        std::env::var("KLIN_N_GPU_LAYERS").unwrap_or_else(|_| "-1".to_string());
    let ctx_size =
        std::env::var("KLIN_CTX_SIZE").unwrap_or_else(|_| "4096".to_string());
    let port =
        std::env::var("KLIN_LLAMA_PORT").unwrap_or_else(|_| "8080".to_string());

    let mut args = vec![
        "-m".to_string(),
        model_path.clone(),
        "-ngl".to_string(),
        n_gpu_layers.clone(),
        "-c".to_string(),
        ctx_size.clone(),
        "--host".to_string(),
        "127.0.0.1".to_string(),
        "--port".to_string(),
        port.clone(),
        "--embedding".to_string(),
        "--pooling".to_string(),
        "mean".to_string(),
        "--no-webui".to_string(),
    ];

    let mmproj_path = std::env::var("KLIN_MMPROJ_PATH").unwrap_or_default();
    if !mmproj_path.is_empty() {
        args.push("--mmproj".to_string());
        args.push(mmproj_path);
    }

    let sidecar_cmd = app
        .shell()
        .sidecar("llama-server")
        .map_err(|e| format!("Failed to create llama-server sidecar: {e}"))?
        .args(args);

    let (mut rx, child) = sidecar_cmd
        .spawn()
        .map_err(|e| format!("Failed to spawn llama-server: {e}"))?;

    let is_alive = Arc::new(AtomicBool::new(true));
    let is_alive_clone = is_alive.clone();

    tauri::async_runtime::spawn(async move {
        while let Some(event) = rx.recv().await {
            match event {
                CommandEvent::Stdout(line) => {
                    eprintln!("[llama-server] {}", String::from_utf8_lossy(&line));
                }
                CommandEvent::Stderr(line) => {
                    eprintln!(
                        "[llama-server][stderr] {}",
                        String::from_utf8_lossy(&line)
                    );
                }
                CommandEvent::Terminated(payload) => {
                    eprintln!(
                        "[llama-server] terminated (code: {:?}, signal: {:?})",
                        payload.code, payload.signal
                    );
                    is_alive_clone.store(false, Ordering::SeqCst);
                    break;
                }
                _ => {}
            }
        }
    });

    eprintln!(
        "[llama-server] Spawned — model: {}, ngl: {}, ctx: {}, port: {}",
        model_path, n_gpu_layers, ctx_size, port
    );

    Ok((child, is_alive))
}

// ── Public lifecycle API ───────────────────────────────────────────────

/// Start (or ensure) llama-server is running. Updates the idle timer.
pub fn ensure_llama_server_running<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    state: &AppState,
) -> Result<(), String> {
    if is_llama_server_ready() {
        *state.llama_last_used.lock() = Some(Instant::now());
        return Ok(());
    }

    let mut child_slot = state.llama_server_child.lock();

    // Double-check under the lock.
    if is_llama_server_ready() {
        *state.llama_last_used.lock() = Some(Instant::now());
        return Ok(());
    }

    if let Some(existing) = child_slot.take() {
        if let Err(e) = existing.kill() {
            eprintln!("[llama-server] stale child cleanup failed: {}", e);
        }
    }

    let (child, is_alive) = spawn_llama_server(app)?;
    *child_slot = Some(child);

    if let Err(e) =
        wait_for_llama_server_ready(Duration::from_secs(60), &is_alive)
    {
        if let Some(failed) = child_slot.take() {
            let _ = failed.kill();
        }
        return Err(e);
    }

    *state.llama_last_used.lock() = Some(Instant::now());
    Ok(())
}

/// Stop the running llama-server and clear the idle timer.
pub fn stop_llama_server_process(state: &AppState) {
    super::kill_sidecar("llama-server", &state.llama_server_child);
    *state.llama_last_used.lock() = None;
}

// ── Idle-timeout background task ───────────────────────────────────────

/// Spawn a background thread that stops llama-server after it has been idle
/// for `KLIN_LLAMA_IDLE_TIMEOUT` seconds (default: 300).
pub fn spawn_idle_timeout_task(
    child_slot: Arc<Mutex<Option<CommandChild>>>,
    last_used: Arc<Mutex<Option<Instant>>>,
) {
    let idle_timeout_secs: u64 = std::env::var("KLIN_LLAMA_IDLE_TIMEOUT")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(300);

    tauri::async_runtime::spawn_blocking(move || {
        let poll_interval = Duration::from_secs(30);
        let idle_limit = Duration::from_secs(idle_timeout_secs);

        eprintln!(
            "[idle-timer] llama-server idle timeout: {}s (poll every {}s)",
            idle_timeout_secs,
            poll_interval.as_secs()
        );

        loop {
            std::thread::sleep(poll_interval);

            let should_stop = {
                let guard = last_used.lock();
                match *guard {
                    Some(last) => last.elapsed() > idle_limit,
                    None => false,
                }
            };

            if should_stop {
                eprintln!(
                    "[idle-timer] llama-server idle for >{}s — stopping",
                    idle_timeout_secs
                );
                let child = child_slot.lock().take();
                if let Some(child) = child {
                    if let Err(e) = child.kill() {
                        eprintln!("[idle-timer] kill failed: {}", e);
                    } else {
                        eprintln!("[idle-timer] llama-server stopped");
                    }
                }
                *last_used.lock() = None;
            }
        }
    });
}
