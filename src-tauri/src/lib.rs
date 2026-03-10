mod commands;
mod domain;
mod dto;
mod infrastructure;
mod repositories;
mod services;

use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::net::{SocketAddr, TcpStream};
use std::time::{Duration, Instant};

use parking_lot::Mutex;
use tauri::{Emitter, Manager};
use tauri_plugin_deep_link::DeepLinkExt;
use tauri_plugin_shell::process::{CommandChild, CommandEvent};
use tauri_plugin_shell::ShellExt;

use repositories::{
    json_category_repository::JsonCategoryRepository, json_log_repository::JsonLogRepository,
    json_rule_repository::JsonRuleRepository,
};
use services::{
    category_service::CategoryService, log_service::LogService, rule_service::RuleService,
};

// ── App State ───────────────────────────────────────────────────────────

pub struct AppState {
    pub log_service: Arc<Mutex<LogService<JsonLogRepository>>>,
    pub rule_service: Arc<Mutex<RuleService<JsonRuleRepository>>>,
    pub category_service: Arc<Mutex<CategoryService<JsonCategoryRepository>>>,
    pub app_data_dir: PathBuf,
    pub llama_server_child: Arc<Mutex<Option<CommandChild>>>,
    pub worker_child: Arc<Mutex<Option<CommandChild>>>,
    /// Timestamp of the last `ensure_llama_server` call.
    /// Used by the idle-timeout task to auto-stop llama-server.
    pub llama_last_used: Arc<Mutex<Option<Instant>>>,
}

fn env_flag(name: &str) -> bool {
    std::env::var(name)
        .map(|value| {
            matches!(
                value.trim().to_ascii_lowercase().as_str(),
                "1" | "true" | "yes" | "on"
            )
        })
        .unwrap_or(false)
}

fn llama_port() -> u16 {
    std::env::var("KLIN_LLAMA_PORT")
        .ok()
        .and_then(|value| value.parse::<u16>().ok())
        .unwrap_or(8080)
}

fn llama_socket_addr() -> SocketAddr {
    SocketAddr::from(([127, 0, 0, 1], llama_port()))
}

fn is_llama_server_ready() -> bool {
    TcpStream::connect_timeout(&llama_socket_addr(), Duration::from_millis(250)).is_ok()
}

fn wait_for_llama_server_ready(timeout: Duration, is_alive: &Arc<AtomicBool>) -> Result<(), String> {
    let started_at = std::time::Instant::now();

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

fn stop_sidecar(name: &str, child_slot: &Arc<Mutex<Option<CommandChild>>>) {
    let child = child_slot.lock().take();

    if let Some(child) = child {
        if let Err(error) = child.kill() {
            eprintln!("[shutdown] {} kill failed: {}", name, error);
        } else {
            eprintln!("[shutdown] {} stopped", name);
        }
    }
}

pub(crate) fn ensure_llama_server_running<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    state: &AppState,
) -> Result<(), String> {
    if is_llama_server_ready() {
        *state.llama_last_used.lock() = Some(Instant::now());
        return Ok(());
    }

    let mut child_slot = state.llama_server_child.lock();

    if is_llama_server_ready() {
        *state.llama_last_used.lock() = Some(Instant::now());
        return Ok(());
    }

    if let Some(existing_child) = child_slot.take() {
        if let Err(error) = existing_child.kill() {
            eprintln!("[llama-server] stale child cleanup failed: {}", error);
        }
    }

    let (child, is_alive) = spawn_llama_server(app)?;
    *child_slot = Some(child);

    if let Err(error) = wait_for_llama_server_ready(Duration::from_secs(60), &is_alive) {
        if let Some(failed_child) = child_slot.take() {
            let _ = failed_child.kill();
        }
        return Err(error);
    }

    *state.llama_last_used.lock() = Some(Instant::now());
    Ok(())
}

/// Stop a running llama-server and clear its idle timer.
pub(crate) fn stop_llama_server_process(state: &AppState) {
    stop_sidecar("llama-server", &state.llama_server_child);
    *state.llama_last_used.lock() = None;
}

fn cleanup_sidecars<R: tauri::Runtime>(app: &tauri::AppHandle<R>) {
    let state = app.state::<AppState>();
    stop_sidecar("llama-server", &state.llama_server_child);
    stop_sidecar("klin-worker", &state.worker_child);
}

// ── Sidecar Management ─────────────────────────────────────────────────

fn spawn_llama_server<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
) -> Result<(CommandChild, Arc<AtomicBool>), String> {
    let model_path = std::env::var("KLIN_MODEL_PATH").unwrap_or_default();

    if model_path.is_empty() {
        return Err("KLIN_MODEL_PATH not set in .env — skipping llama-server.".to_string());
    }

    let n_gpu_layers = std::env::var("KLIN_N_GPU_LAYERS").unwrap_or_else(|_| "-1".to_string());
    let ctx_size = std::env::var("KLIN_CTX_SIZE").unwrap_or_else(|_| "4096".to_string());
    let port = std::env::var("KLIN_LLAMA_PORT").unwrap_or_else(|_| "8080".to_string());

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

    // Forward llama-server output to stderr for Tauri dev console
    tauri::async_runtime::spawn(async move {
        while let Some(event) = rx.recv().await {
            match event {
                CommandEvent::Stdout(line) => {
                    eprintln!("[llama-server] {}", String::from_utf8_lossy(&line));
                }
                CommandEvent::Stderr(line) => {
                    eprintln!("[llama-server][stderr] {}", String::from_utf8_lossy(&line));
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

fn spawn_klin_worker<R: tauri::Runtime>(
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
                    eprintln!("[klin-worker][stderr] {}", String::from_utf8_lossy(&line));
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

// ── App Entry Point ─────────────────────────────────────────────────────

pub fn run() {
    // Load .env file (silently ignore if not found)
    let _ = dotenvy::dotenv();

    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            if let Some(main_window) = app.get_webview_window("main") {
                let _ = main_window.show();
                let _ = main_window.set_focus();
            }

            if let Some(url) = argv.iter().find(|arg| arg.starts_with("klin://auth")) {
                let _ = app.emit("deep-link://oauth-callback", url.clone());
            }
        }))
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let app_data_dir = infrastructure::app_paths::resolve_app_data_dir(app.handle())?;
            let app_data_dir_str = app_data_dir.to_string_lossy().to_string();
            std::fs::create_dir_all(&app_data_dir)?;
            let use_external_worker = env_flag("KLIN_WORKER_EXTERNAL");

            // ── Spawn sidecars ──────────────────────────────────────
            eprintln!("[startup] llama-server: lazy startup enabled");
            let llama_child: Option<CommandChild> = None;

            let worker_child: Option<CommandChild> = if use_external_worker {
                eprintln!("[startup] klin-worker: external mode enabled, skipping sidecar spawn");
                None
            } else {
                match spawn_klin_worker(app.handle(), &app_data_dir_str) {
                    Ok(child) => Some(child),
                    Err(e) => {
                        eprintln!("[startup] klin-worker: {}", e);
                        None
                    }
                }
            };

            // ── Repositories & services ─────────────────────────────
            let log_repo = JsonLogRepository::new(app_data_dir.join("logs.json"));
            let rule_repo = JsonRuleRepository::new(app_data_dir.join("rules.json"));
            let category_repo = JsonCategoryRepository::new(app_data_dir.join("categories.json"));

            let llama_server_child = Arc::new(Mutex::new(llama_child));
            let llama_last_used: Arc<Mutex<Option<Instant>>> = Arc::new(Mutex::new(None));

            app.manage(AppState {
                log_service: Arc::new(Mutex::new(LogService::new(log_repo))),
                rule_service: Arc::new(Mutex::new(RuleService::new(rule_repo))),
                category_service: Arc::new(Mutex::new(CategoryService::new(category_repo))),
                app_data_dir: app_data_dir.clone(),
                llama_server_child: llama_server_child.clone(),
                worker_child: Arc::new(Mutex::new(worker_child)),
                llama_last_used: llama_last_used.clone(),
            });

            // ── Idle-timeout task for llama-server ───────────────
            {
                let idle_timeout_secs: u64 = std::env::var("KLIN_LLAMA_IDLE_TIMEOUT")
                    .ok()
                    .and_then(|v| v.parse().ok())
                    .unwrap_or(300); // default 5 minutes

                let idle_child = llama_server_child.clone();
                let idle_last_used = llama_last_used.clone();

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
                            let guard = idle_last_used.lock();
                            match *guard {
                                Some(last) => last.elapsed() > idle_limit,
                                None => false, // never started or already stopped
                            }
                        };

                        if should_stop {
                            eprintln!(
                                "[idle-timer] llama-server idle for >{}s — stopping",
                                idle_timeout_secs
                            );
                            // Stop the child process
                            let child = idle_child.lock().take();
                            if let Some(child) = child {
                                if let Err(e) = child.kill() {
                                    eprintln!("[idle-timer] kill failed: {}", e);
                                } else {
                                    eprintln!("[idle-timer] llama-server stopped");
                                }
                            }
                            *idle_last_used.lock() = None;
                        }
                    }
                });
            }

            // ── Deep link ───────────────────────────────────────────
            #[cfg(any(windows, target_os = "linux"))]
            {
                app.deep_link().register("klin")?;
            }

            let handle = app.handle().clone();
            app.deep_link().on_open_url(move |event| {
                if let Some(url) = event
                    .urls()
                    .iter()
                    .find(|url| url.as_str().starts_with("klin://auth"))
                {
                    let _ = handle.emit("deep-link://oauth-callback", url.to_string());
                }
            });

            // ── Window close → hide ─────────────────────────────────
            if let Some(main_window) = app.get_webview_window("main") {
                let close_window = main_window.clone();
                main_window.on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                        api.prevent_close();
                        let _ = close_window.hide();
                    }
                });
            }

            // ── Background folder scanner ───────────────────────────
            let scanner_app_handle = app.handle().clone();
            std::thread::spawn(move || {
                let mut previous_has_files = false;

                loop {
                    std::thread::sleep(Duration::from_secs(60));

                    let config = match commands::load_automation_config(scanner_app_handle.clone())
                    {
                        Ok(config) => config,
                        Err(_) => continue,
                    };

                    if !config.auto_organize_enabled || config.watched_folders.is_empty() {
                        previous_has_files = false;
                        continue;
                    }

                    let has_files = config.watched_folders.iter().any(|folder| {
                        services::file_service::FileService::read_folder(folder.clone())
                            .map(|files| !files.is_empty())
                            .unwrap_or(false)
                    });

                    if has_files && !previous_has_files {
                        if let Some(main_window) = scanner_app_handle.get_webview_window("main") {
                            let _ = main_window.show();
                            let _ = main_window.set_focus();
                        }
                    }

                    previous_has_files = has_files;
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::watch_folder,
            commands::move_file,
            commands::read_folder,
            commands::ensure_llama_server,
            commands::stop_llama_server,
            commands::pick_files_for_organize,
            commands::pick_folder_for_organize,
            commands::save_note_file,
            commands::open_external_url,
            commands::delete_file,
            commands::get_downloads_folder,
            commands::get_app_data_dir,
            commands::list_note_files,
            commands::read_note_file,
            commands::write_log,
            commands::list_logs,
            commands::get_categories,
            commands::save_rule_mapping,
            commands::start_oauth_listener,
            commands::save_automation_config,
            commands::load_automation_config,
            commands::pick_folders_for_batch,
            commands::list_subdirectories,
            commands::list_all_subdirectories,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| {
            if matches!(event, tauri::RunEvent::ExitRequested { .. } | tauri::RunEvent::Exit) {
                cleanup_sidecars(app);
            }
        });
}
