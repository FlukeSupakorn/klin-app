use std::net::{SocketAddr, TcpStream};
use std::sync::Arc;
use std::time::{Duration, Instant};

use parking_lot::{Condvar, Mutex};
use tauri_plugin_shell::process::{CommandChild, CommandEvent};
use tauri_plugin_shell::ShellExt;

use crate::AppState;

// ── Launch phase ───────────────────────────────────────────────────────

/// Authoritative state of the llama-server process.
///
/// Transitions:
/// ```text
/// Idle / Crashed  ──(spawn attempt)──►  Starting
/// Starting        ──(TCP ready)──────►  Running
/// Starting        ──(crash/timeout)──►  Crashed
/// Running         ──(TCP probe fail)──► Crashed
/// Running         ──(stop/idle kill)──► Idle
/// Crashed         ──(next caller)────►  Starting  (retry)
/// ```
#[derive(Debug, Clone, PartialEq)]
pub enum LaunchPhase {
    /// No process exists (never started, cleanly stopped, or idle-killed).
    Idle,
    /// A process has been spawned and is still warming up (TCP not yet listening).
    Starting,
    /// Process is running and the TCP port is accepting connections.
    Running,
    /// The most recent spawn attempt failed, or the process crashed.
    Crashed(String),
}

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

/// Poll TCP until the port is open, timed out, or the process crashes.
///
/// Checks `phase` each interval so a `Crashed` transition (set by the
/// async termination handler) causes an early exit rather than waiting
/// for the full timeout.
///
/// On success the caller is responsible for transitioning the phase to
/// `Running` and notifying waiters via the condvar.
fn wait_for_llama_server_ready(
    timeout: Duration,
    phase: &Arc<Mutex<LaunchPhase>>,
) -> Result<(), String> {
    let started_at = Instant::now();

    while started_at.elapsed() < timeout {
        // Early exit if the async termination monitor already observed a crash.
        {
            let p = phase.lock();
            if let LaunchPhase::Crashed(ref msg) = *p {
                return Err(format!(
                    "llama-server crashed during startup: {}",
                    msg
                ));
            }
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
///
/// `phase` and `condvar` are borrowed so the async termination monitor
/// can transition to `Crashed` and wake any waiting callers.
///
/// Returns the `CommandChild` on success.
pub fn spawn_llama_server<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    phase: Arc<Mutex<LaunchPhase>>,
    condvar: Arc<Condvar>,
) -> Result<CommandChild, String> {
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

    // Async monitor: sets phase → Crashed on termination and wakes waiters.
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
                    let mut p = phase.lock();
                    // Don't overwrite an intentional Idle (clean stop/idle-kill).
                    if !matches!(*p, LaunchPhase::Idle) {
                        *p = LaunchPhase::Crashed(format!(
                            "process terminated (code: {:?})",
                            payload.code
                        ));
                    }
                    condvar.notify_all();
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

    Ok(child)
}

// ── Public lifecycle API ───────────────────────────────────────────────

/// Ensure the llama-server is running and ready to accept requests.
///
/// # Concurrency safety
///
/// Uses a [`LaunchPhase`] state machine + `Condvar` so that:
/// - If the server is **already `Running`** a quick TCP probe is done and
///   the call returns immediately.
/// - If a spawn is **already `Starting`** (another caller is warming it
///   up) this caller waits on the condvar instead of killing the process
///   and racing to start another one.
/// - If the server is **`Idle` or `Crashed`** this caller transitions to
///   `Starting`, drops the phase lock, kills any stale child, spawns a
///   new one, polls for TCP readiness (no lock held), then transitions to
///   `Running` / `Crashed` and wakes all waiters.
pub fn ensure_llama_server_running<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    state: &AppState,
) -> Result<(), String> {
    loop {
        let mut phase = state.llama_phase.lock();

        match &*phase {
            // ── Already running ───────────────────────────────────────
            LaunchPhase::Running => {
                // TCP probe to catch crashes that haven't propagated via the
                // async termination handler yet (e.g. killed externally).
                // The phase lock is held for ≤250 ms (connect_timeout).
                if is_llama_server_ready() {
                    *state.llama_last_used.lock() = Some(Instant::now());
                    return Ok(());
                }
                // Port closed but phase still says Running → must have crashed.
                *phase = LaunchPhase::Crashed(
                    "TCP probe failed on a previously-Running server".to_string(),
                );
                state.llama_phase_condvar.notify_all();
                // Loop back; this caller will now see Crashed and respawn.
            }

            // ── Another caller is already starting it ─────────────────
            LaunchPhase::Starting => {
                // Block until the spawning caller transitions out of Starting.
                state.llama_phase_condvar.wait(&mut phase);
                // Re-evaluate — could now be Running, Crashed, or (rarely) Idle.
                continue;
            }

            // ── Need to spawn ─────────────────────────────────────────
            LaunchPhase::Idle | LaunchPhase::Crashed(_) => {
                // Claim ownership of the spawn. Any concurrent caller that
                // enters after this drop will see Starting and wait on the condvar.
                *phase = LaunchPhase::Starting;
                state.llama_phase_condvar.notify_all();
                drop(phase); // ← phase lock released before any I/O

                // Kill stale child (brief lock, no I/O inside).
                {
                    let mut child_slot = state.llama_server_child.lock();
                    if let Some(existing) = child_slot.take() {
                        if let Err(e) = existing.kill() {
                            eprintln!("[llama-server] stale child cleanup failed: {}", e);
                        }
                    }
                }

                // Spawn. Pass clones of phase + condvar so the async monitor
                // can transition to Crashed and wake waiters on termination.
                let spawn_result = spawn_llama_server(
                    app,
                    Arc::clone(&state.llama_phase),
                    Arc::clone(&state.llama_phase_condvar),
                );

                let child = match spawn_result {
                    Ok(c) => c,
                    Err(e) => {
                        let mut p = state.llama_phase.lock();
                        *p = LaunchPhase::Crashed(e.clone());
                        state.llama_phase_condvar.notify_all();
                        return Err(e);
                    }
                };

                *state.llama_server_child.lock() = Some(child);

                // Poll for TCP readiness — no lock held during this wait.
                match wait_for_llama_server_ready(
                    Duration::from_secs(60),
                    &state.llama_phase,
                ) {
                    Ok(()) => {
                        let mut p = state.llama_phase.lock();
                        *p = LaunchPhase::Running;
                        state.llama_phase_condvar.notify_all();
                        *state.llama_last_used.lock() = Some(Instant::now());
                        return Ok(());
                    }
                    Err(e) => {
                        // Kill the unresponsive child.
                        if let Some(failed) = state.llama_server_child.lock().take() {
                            let _ = failed.kill();
                        }
                        // Transition to Crashed only if the async monitor
                        // hasn't already done so.
                        let mut p = state.llama_phase.lock();
                        if !matches!(*p, LaunchPhase::Crashed(_)) {
                            *p = LaunchPhase::Crashed(e.clone());
                        }
                        state.llama_phase_condvar.notify_all();
                        return Err(e);
                    }
                }
            }
        }
    }
}

/// Stop the running llama-server and clear the idle timer.
pub fn stop_llama_server_process(state: &AppState) {
    super::kill_sidecar("llama-server", &state.llama_server_child);
    // Mark Idle *before* notify so the async termination handler
    // (which fires shortly after) sees Idle and skips setting Crashed.
    *state.llama_phase.lock() = LaunchPhase::Idle;
    state.llama_phase_condvar.notify_all();
    *state.llama_last_used.lock() = None;
}

// ── Idle-timeout background task ───────────────────────────────────────

/// Spawn a background thread that stops llama-server after it has been idle
/// for `KLIN_LLAMA_IDLE_TIMEOUT` seconds (default: 300).
pub fn spawn_idle_timeout_task(
    child_slot: Arc<Mutex<Option<CommandChild>>>,
    last_used: Arc<Mutex<Option<Instant>>>,
    phase: Arc<Mutex<LaunchPhase>>,
    condvar: Arc<Condvar>,
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
                // Set Idle first so the async termination handler skips
                // transitioning to Crashed when the kill signal arrives.
                *phase.lock() = LaunchPhase::Idle;
                condvar.notify_all();

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
