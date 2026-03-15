mod commands;
mod domain;
mod dto;
mod infrastructure;
mod repositories;
mod services;
mod sidecars;

use std::path::PathBuf;
use std::sync::atomic::AtomicBool;
use std::sync::Arc;
use std::time::{Duration, Instant};

use parking_lot::{Condvar, Mutex};
use tauri::{Emitter, Manager};
use tauri_plugin_deep_link::DeepLinkExt;
use tauri_plugin_shell::process::CommandChild;

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
    /// Authoritative lifecycle phase of the llama-server process.
    /// Guards concurrent startup and crash detection.
    pub llama_phase: Arc<Mutex<sidecars::llama_server::LaunchPhase>>,
    /// Condvar paired with `llama_phase`; notified on every phase transition.
    pub llama_phase_condvar: Arc<Condvar>,
    /// Set by explicit `stop_llama_server_process` to prevent concurrent
    /// `ensure_llama_server_running` callers from immediately respawning.
    pub llama_stop_requested: Arc<AtomicBool>,
    /// Shutdown signal for the idle-timeout background task.
    pub llama_idle_shutdown: Arc<Mutex<bool>>,
    pub llama_idle_shutdown_condvar: Arc<Condvar>,
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
                match sidecars::spawn_klin_worker(app.handle(), &app_data_dir_str) {
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
            let llama_phase = Arc::new(Mutex::new(
                sidecars::llama_server::LaunchPhase::Idle,
            ));
            let llama_phase_condvar = Arc::new(Condvar::new());
            let llama_idle_shutdown = Arc::new(Mutex::new(false));
            let llama_idle_shutdown_condvar = Arc::new(Condvar::new());

            app.manage(AppState {
                log_service: Arc::new(Mutex::new(LogService::new(log_repo))),
                rule_service: Arc::new(Mutex::new(RuleService::new(rule_repo))),
                category_service: Arc::new(Mutex::new(CategoryService::new(category_repo))),
                app_data_dir: app_data_dir.clone(),
                llama_server_child: llama_server_child.clone(),
                worker_child: Arc::new(Mutex::new(worker_child)),
                llama_last_used: llama_last_used.clone(),
                llama_phase: llama_phase.clone(),
                llama_phase_condvar: llama_phase_condvar.clone(),
                llama_stop_requested: Arc::new(AtomicBool::new(false)),
                llama_idle_shutdown: llama_idle_shutdown.clone(),
                llama_idle_shutdown_condvar: llama_idle_shutdown_condvar.clone(),
            });

            // ── Idle-timeout task for llama-server ───────────────
            sidecars::spawn_idle_timeout_task(
                llama_server_child.clone(),
                llama_last_used.clone(),
                llama_phase.clone(),
                llama_phase_condvar.clone(),
                llama_idle_shutdown.clone(),
                llama_idle_shutdown_condvar.clone(),
            );

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
            commands::touch_llama_server,
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
                // Signal idle-timeout thread to exit cleanly.
                let state = app.state::<AppState>();
                *state.llama_idle_shutdown.lock() = true;
                state.llama_idle_shutdown_condvar.notify_all();

                sidecars::cleanup_all(app);
            }
        });
}
