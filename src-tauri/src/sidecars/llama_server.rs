use std::io::{Read, Write};
use std::net::{SocketAddr, TcpStream};
use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};

use parking_lot::{Condvar, Mutex};
use tauri_plugin_shell::process::{CommandChild, CommandEvent};
use tauri_plugin_shell::ShellExt;

use crate::infrastructure::runtime_env;

const DEFAULT_IDLE_TIMEOUT_SECS: u64 = 60;
const IDLE_POLL_INTERVAL_SECS: u64 = 30;

// ── Model slot ───────────────────────────────────────────────────────

/// Identifies which llama-server instance to manage.
#[derive(Clone, Copy, PartialEq, Eq, Hash, Debug)]
pub enum ModelSlot {
    /// Qwen2.5-VL vision+chat model.
    Chat,
    /// Text embedding model.
    Embed,
}

impl ModelSlot {
    pub fn from_str(s: &str) -> Result<Self, String> {
        match s {
            "chat" => Ok(Self::Chat),
            "embed" => Ok(Self::Embed),
            _ => Err(format!("unknown model slot: {s}")),
        }
    }

    pub fn label(&self) -> &'static str {
        match self {
            Self::Chat => "chat",
            Self::Embed => "embed",
        }
    }
}

// ── Per-slot state ───────────────────────────────────────────────────

/// All state needed to manage one llama-server instance.
pub struct LlamaSlotState {
    pub slot: ModelSlot,
    pub child: Arc<Mutex<Option<CommandChild>>>,
    pub last_used: Arc<Mutex<Option<Instant>>>,
    pub phase: Arc<Mutex<LaunchPhase>>,
    pub phase_condvar: Arc<Condvar>,
    pub stop_requested: Arc<AtomicBool>,
    pub idle_shutdown: Arc<Mutex<bool>>,
    pub shutdown_condvar: Arc<Condvar>,
}

impl LlamaSlotState {
    pub fn new(slot: ModelSlot) -> Self {
        Self {
            slot,
            child: Arc::new(Mutex::new(None)),
            last_used: Arc::new(Mutex::new(None)),
            phase: Arc::new(Mutex::new(LaunchPhase::Idle)),
            phase_condvar: Arc::new(Condvar::new()),
            stop_requested: Arc::new(AtomicBool::new(false)),
            idle_shutdown: Arc::new(Mutex::new(false)),
            shutdown_condvar: Arc::new(Condvar::new()),
        }
    }
}

// ── Launch phase ───────────────────────────────────────────────────────

/// Authoritative state of a llama-server process.
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

fn slot_port(slot: &ModelSlot) -> u16 {
    match slot {
        ModelSlot::Chat => runtime_env::get("KLIN_CHAT_PORT")
            .or_else(|| runtime_env::get("KLIN_LLAMA_PORT"))
            .and_then(|v| v.parse::<u16>().ok())
            .unwrap_or(8080),
        ModelSlot::Embed => runtime_env::get("KLIN_EMBED_PORT")
            .and_then(|v| v.parse::<u16>().ok())
            .unwrap_or(8081),
    }
}

fn slot_socket_addr(slot: &ModelSlot) -> SocketAddr {
    SocketAddr::from(([127, 0, 0, 1], slot_port(slot)))
}

fn validate_model_path(slot: ModelSlot, model_path: &str) -> Result<(), String> {
    if !Path::new(model_path).exists() {
        return Err(format!(
            "llama-server[{}] model path does not exist: {}",
            slot.label(),
            model_path
        ));
    }
    if matches!(slot, ModelSlot::Chat) {
        let lower = model_path.to_ascii_lowercase();
        if lower.contains("mmproj") {
            return Err(
                "KLIN_CHAT_MODEL_PATH points to an mmproj projector GGUF. Set chat model to a text/vision LLM GGUF and keep projector in KLIN_MMPROJ_PATH.".to_string(),
            );
        }

        let mmproj_path = runtime_env::get("KLIN_MMPROJ_PATH").unwrap_or_default();
        if !mmproj_path.is_empty() && mmproj_path == model_path {
            return Err(
                "KLIN_CHAT_MODEL_PATH and KLIN_MMPROJ_PATH point to the same file. Use the LLM GGUF for chat and projector GGUF for KLIN_MMPROJ_PATH.".to_string(),
            );
        }
    }
    if matches!(slot, ModelSlot::Embed) {
        let chat_path = runtime_env::get("KLIN_CHAT_MODEL_PATH").unwrap_or_default();
        if !chat_path.is_empty() && chat_path == model_path {
            return Err(
                "KLIN_EMBED_MODEL_PATH points to the same GGUF as chat — set a real embedding model.".to_string(),
            );
        }
    }
    Ok(())
}

fn idle_timeout_secs() -> u64 {
    std::env::var("KLIN_LLAMA_IDLE_TIMEOUT")
        .ok()
        .and_then(|v| v.parse().ok())
        .or_else(|| runtime_env::get("KLIN_LLAMA_IDLE_TIMEOUT").and_then(|v| v.parse().ok()))
        .unwrap_or(DEFAULT_IDLE_TIMEOUT_SECS)
}

// ── Readiness probe ────────────────────────────────────────────────────

fn tcp_probe_timeout() -> Duration {
    match runtime_env::get("KLIN_TCP_PROBE_TIMEOUT_MS") {
        Some(val) => match val.parse::<u64>() {
            Ok(ms) => Duration::from_millis(ms),
            Err(_) => {
                tracing::info!(
                    "[llama-server] KLIN_TCP_PROBE_TIMEOUT_MS={:?} is not a valid u64, using 250ms",
                    val
                );
                Duration::from_millis(250)
            }
        },
        None => Duration::from_millis(250),
    }
}

fn is_slot_ready(slot: &ModelSlot) -> bool {
    TcpStream::connect_timeout(&slot_socket_addr(slot), tcp_probe_timeout()).is_ok()
}

fn is_slot_http_healthy(slot: &ModelSlot) -> bool {
    let addr = slot_socket_addr(slot);
    let mut stream = match TcpStream::connect_timeout(&addr, tcp_probe_timeout()) {
        Ok(s) => s,
        Err(_) => return false,
    };
    let _ = stream.set_read_timeout(Some(Duration::from_secs(1)));
    let _ = stream.set_write_timeout(Some(Duration::from_secs(1)));
    let request = format!(
        "GET /health HTTP/1.1\r\nHost: {}\r\nConnection: close\r\n\r\n",
        addr
    );
    if stream.write_all(request.as_bytes()).is_err() {
        return false;
    }
    let mut response = String::new();
    if stream.read_to_string(&mut response).is_err() {
        return false;
    }
    response.starts_with("HTTP/1.1 200") || response.starts_with("HTTP/1.0 200")
}

/// Poll TCP until the port is open, timed out, or the process crashes.
///
/// Checks `phase` each interval so a `Crashed` transition (set by the
/// async termination handler) causes an early exit rather than waiting
/// for the full timeout.
fn wait_for_slot_ready(
    timeout: Duration,
    phase: &Arc<Mutex<LaunchPhase>>,
    slot: &ModelSlot,
) -> Result<(), String> {
    let started_at = Instant::now();
    let label = slot.label();
    let addr = slot_socket_addr(slot);

    while started_at.elapsed() < timeout {
        {
            let p = phase.lock();
            if let LaunchPhase::Crashed(ref msg) = *p {
                return Err(format!(
                    "llama-server[{}] crashed during startup: {}",
                    label, msg
                ));
            }
        }

        if is_slot_http_healthy(slot) {
            return Ok(());
        }

        std::thread::sleep(tcp_probe_timeout());
    }

    Err(format!(
        "Timed out waiting for llama-server[{}] to listen on {}",
        label, addr
    ))
}

// ── Spawn ──────────────────────────────────────────────────────────────

/// Spawn the llama-server sidecar for the given slot.
fn spawn_slot<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    slot: &LlamaSlotState,
) -> Result<CommandChild, String> {
    let label = slot.slot.label();
    let port = slot_port(&slot.slot).to_string();

    let (model_path, args) = match slot.slot {
        ModelSlot::Chat => {
            let model_path = runtime_env::get("KLIN_CHAT_MODEL_PATH").unwrap_or_default();

            if model_path.is_empty() {
                return Err(format!(
                    "KLIN_CHAT_MODEL_PATH not set — skipping llama-server[{}].",
                    label
                ));
            }

            validate_model_path(slot.slot, &model_path)?;

            let n_gpu_layers = runtime_env::get_or("KLIN_N_GPU_LAYERS", "-1");
            let ctx_size = runtime_env::get_or("KLIN_CTX_SIZE", "4096");

            let mut args = vec![
                "-m".to_string(),
                model_path.clone(),
                "-ngl".to_string(),
                n_gpu_layers,
                "-c".to_string(),
                ctx_size,
                "--host".to_string(),
                "127.0.0.1".to_string(),
                "--port".to_string(),
                port.clone(),
                "--no-webui".to_string(),
            ];

            let mmproj_path = runtime_env::get("KLIN_MMPROJ_PATH").unwrap_or_default();
            if !mmproj_path.is_empty() {
                args.push("--mmproj".to_string());
                args.push(mmproj_path);
            }

            (model_path, args)
        }
        ModelSlot::Embed => {
            let model_path = runtime_env::get("KLIN_EMBED_MODEL_PATH").unwrap_or_default();

            if model_path.is_empty() {
                return Err(format!(
                    "KLIN_EMBED_MODEL_PATH not set — skipping llama-server[{}].",
                    label
                ));
            }

            validate_model_path(slot.slot, &model_path)?;

            let n_gpu_layers = runtime_env::get_or("KLIN_EMBED_N_GPU_LAYERS", "0");

            let args = vec![
                "-m".to_string(),
                model_path.clone(),
                "-ngl".to_string(),
                n_gpu_layers,
                "--host".to_string(),
                "127.0.0.1".to_string(),
                "--port".to_string(),
                port.clone(),
                "--no-webui".to_string(),
                "--embedding".to_string(),
                "--pooling".to_string(),
                "mean".to_string(),
            ];

            (model_path, args)
        }
    };

    let sidecar_cmd = app
        .shell()
        .sidecar("llama-server")
        .map_err(|e| format!("Failed to create llama-server[{}] sidecar: {e}", label))?
        .args(args);

    let (mut rx, child) = sidecar_cmd
        .spawn()
        .map_err(|e| format!("Failed to spawn llama-server[{}]: {e}", label))?;

    // Async monitor: sets phase → Crashed on termination and wakes waiters.
    let phase = Arc::clone(&slot.phase);
    let condvar = Arc::clone(&slot.phase_condvar);
    let log_label = label.to_string();
    tauri::async_runtime::spawn(async move {
        while let Some(event) = rx.recv().await {
            match event {
                CommandEvent::Stdout(line) => {
                    tracing::info!(
                        "[llama-server][{}] {}",
                        log_label,
                        String::from_utf8_lossy(&line)
                    );
                }
                CommandEvent::Stderr(line) => {
                    tracing::info!(
                        "[llama-server][{}][stderr] {}",
                        log_label,
                        String::from_utf8_lossy(&line)
                    );
                }
                CommandEvent::Terminated(payload) => {
                    tracing::info!(
                        "[llama-server][{}] terminated (code: {:?}, signal: {:?})",
                        log_label,
                        payload.code,
                        payload.signal
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

    tracing::info!(
        "[llama-server][{}] Spawned — model: {}, port: {}",
        label,
        model_path,
        port
    );

    Ok(child)
}

// ── Public lifecycle API ───────────────────────────────────────────────

/// Ensure the llama-server for the given slot is running and ready.
///
/// Uses a [`LaunchPhase`] state machine + `Condvar` so that concurrent
/// callers are handled safely (see original docs for full details).
pub fn ensure_slot_running<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    slot: &LlamaSlotState,
) -> Result<(), String> {
    let label = slot.slot.label();

    tracing::debug!("[llama-server][{}] ensure requested", label);

    // A new caller wants the server — clear any previous explicit stop request.
    slot.stop_requested.store(false, Ordering::SeqCst);

    loop {
        let mut phase = slot.phase.lock();

        match &*phase {
            // ── Already running ───────────────────────────────────────
            LaunchPhase::Running => {
                if is_slot_ready(&slot.slot) {
                    *slot.last_used.lock() = Some(Instant::now());
                    tracing::debug!(
                        "[llama-server][{}] already running, idle timer refreshed",
                        label
                    );
                    return Ok(());
                }
                *phase = LaunchPhase::Crashed(
                    "TCP probe failed on a previously-Running server".to_string(),
                );
                slot.phase_condvar.notify_all();
            }

            // ── Another caller is already starting it ─────────────────
            LaunchPhase::Starting => {
                slot.phase_condvar.wait(&mut phase);
                continue;
            }

            // ── Need to spawn ─────────────────────────────────────────
            LaunchPhase::Idle | LaunchPhase::Crashed(_) => {
                if slot.stop_requested.load(Ordering::SeqCst) {
                    return Err(format!("llama-server[{}] stopped by user", label));
                }

                // App can restart without owning child handles while a previous healthy
                // llama-server process is still alive on the slot port.
                if is_slot_http_healthy(&slot.slot) {
                    *phase = LaunchPhase::Running;
                    slot.phase_condvar.notify_all();
                    *slot.last_used.lock() = Some(Instant::now());
                    tracing::info!(
                        "[llama-server][{}] Reusing already-running process on {}",
                        label,
                        slot_socket_addr(&slot.slot)
                    );
                    return Ok(());
                }

                if is_slot_ready(&slot.slot) {
                    let msg = format!(
                        "Port {} is already in use but /health is not ready for llama-server[{}]",
                        slot_port(&slot.slot),
                        label
                    );
                    *phase = LaunchPhase::Crashed(msg.clone());
                    slot.phase_condvar.notify_all();
                    return Err(msg);
                }

                tracing::info!("[llama-server][{}] spawning new process", label);
                *phase = LaunchPhase::Starting;
                slot.phase_condvar.notify_all();
                drop(phase);

                // Kill stale child.
                {
                    let mut child_slot = slot.child.lock();
                    if let Some(existing) = child_slot.take() {
                        if let Err(e) = existing.kill() {
                            tracing::info!(
                                "[llama-server][{}] stale child cleanup failed: {}",
                                label,
                                e
                            );
                        }
                    }
                }

                let spawn_result = spawn_slot(app, slot);

                let child = match spawn_result {
                    Ok(c) => c,
                    Err(e) => {
                        let mut p = slot.phase.lock();
                        *p = LaunchPhase::Crashed(e.clone());
                        slot.phase_condvar.notify_all();
                        return Err(e);
                    }
                };

                *slot.child.lock() = Some(child);

                match wait_for_slot_ready(Duration::from_secs(60), &slot.phase, &slot.slot) {
                    Ok(()) => {
                        let mut p = slot.phase.lock();
                        *p = LaunchPhase::Running;
                        slot.phase_condvar.notify_all();
                        *slot.last_used.lock() = Some(Instant::now());
                        tracing::info!("[llama-server][{}] ready and timer started", label);
                        return Ok(());
                    }
                    Err(e) => {
                        if let Some(failed) = slot.child.lock().take() {
                            let _ = failed.kill();
                        }
                        let mut p = slot.phase.lock();
                        if !matches!(*p, LaunchPhase::Crashed(_)) {
                            *p = LaunchPhase::Crashed(e.clone());
                        }
                        slot.phase_condvar.notify_all();
                        return Err(e);
                    }
                }
            }
        }
    }
}

/// Refresh the idle timer without a TCP probe.
///
/// No-ops if the server is not in the `Running` state.
pub fn touch_slot_last_used(slot: &LlamaSlotState) {
    let phase = slot.phase.lock();
    if matches!(*phase, LaunchPhase::Running) {
        *slot.last_used.lock() = Some(Instant::now());
    }
}

/// Stop the running llama-server for a slot and clear the idle timer.
pub fn stop_slot(slot: &LlamaSlotState) {
    let label = slot.slot.label();
    tracing::info!("[llama-server][{}] stop requested", label);
    // Prevent concurrent ensure_slot_running callers from respawning.
    slot.stop_requested.store(true, Ordering::SeqCst);
    super::kill_sidecar(&format!("llama-server[{}]", label), &slot.child);
    // Mark Idle *before* notify so the async termination handler
    // sees Idle and skips setting Crashed.
    *slot.phase.lock() = LaunchPhase::Idle;
    slot.phase_condvar.notify_all();
    *slot.last_used.lock() = None;
}

fn slot_should_idle_stop(last_used: Option<Instant>, idle_limit: Duration) -> bool {
    match last_used {
        Some(last) => last.elapsed() > idle_limit,
        None => false,
    }
}

// ── Idle-timeout background task ───────────────────────────────────────

/// Spawn a background thread that stops a slot's llama-server after idle.
pub fn spawn_idle_timeout_task_for_slot(slot: &LlamaSlotState) {
    let label = slot.slot.label().to_string();
    let child_slot = Arc::clone(&slot.child);
    let last_used = Arc::clone(&slot.last_used);
    let phase = Arc::clone(&slot.phase);
    let condvar = Arc::clone(&slot.phase_condvar);
    let shutdown = Arc::clone(&slot.idle_shutdown);
    let shutdown_condvar = Arc::clone(&slot.shutdown_condvar);

    let idle_timeout_secs = idle_timeout_secs();

    tauri::async_runtime::spawn_blocking(move || {
        let poll_interval = Duration::from_secs(IDLE_POLL_INTERVAL_SECS);
        let idle_limit = Duration::from_secs(idle_timeout_secs);

        tracing::info!(
            "[idle-timer][{}] idle timeout: {}s (poll every {}s)",
            label,
            idle_timeout_secs,
            poll_interval.as_secs()
        );

        loop {
            {
                let mut guard = shutdown.lock();
                if *guard {
                    break;
                }
                shutdown_condvar.wait_for(&mut guard, poll_interval);
                if *guard {
                    break;
                }
            }

            let should_stop = {
                let guard = last_used.lock();
                slot_should_idle_stop(*guard, idle_limit)
            };

            if should_stop {
                tracing::info!(
                    "[idle-timer][{}] idle for >{}s — stopping",
                    label,
                    idle_timeout_secs
                );
                *phase.lock() = LaunchPhase::Idle;
                condvar.notify_all();

                let child = child_slot.lock().take();
                if let Some(child) = child {
                    if let Err(e) = child.kill() {
                        tracing::info!("[idle-timer][{}] kill failed: {}", label, e);
                    } else {
                        tracing::info!("[idle-timer][{}] llama-server stopped", label);
                    }
                }
                *last_used.lock() = None;
            }
        }

        tracing::info!("[idle-timer][{}] shutdown — exiting", label);
    });
}

#[cfg(test)]
mod tests {
    use super::slot_should_idle_stop;
    use std::time::{Duration, Instant};

    #[test]
    fn idle_stop_is_disabled_without_last_use() {
        assert!(!slot_should_idle_stop(None, Duration::from_secs(300)));
    }

    #[test]
    fn idle_stop_triggers_after_limit() {
        let last_used = Instant::now() - Duration::from_secs(301);
        assert!(slot_should_idle_stop(
            Some(last_used),
            Duration::from_secs(300)
        ));
    }

    #[test]
    fn idle_stop_does_not_trigger_before_limit() {
        let last_used = Instant::now() - Duration::from_secs(120);
        assert!(!slot_should_idle_stop(
            Some(last_used),
            Duration::from_secs(300)
        ));
    }
}
