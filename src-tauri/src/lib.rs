mod commands;
mod domain;
mod dto;
mod infrastructure;
mod repositories;
mod services;

use std::path::PathBuf;
use std::sync::Arc;
use std::time::Duration;

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

// ── Sidecar Management ─────────────────────────────────────────────────

fn spawn_llama_server<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
) -> Result<CommandChild, String> {
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
            let llama_child: Option<CommandChild> = match spawn_llama_server(app.handle()) {
                Ok(child) => Some(child),
                Err(e) => {
                    eprintln!("[startup] llama-server: {}", e);
                    None
                }
            };

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

            app.manage(AppState {
                log_service: Arc::new(Mutex::new(LogService::new(log_repo))),
                rule_service: Arc::new(Mutex::new(RuleService::new(rule_repo))),
                category_service: Arc::new(Mutex::new(CategoryService::new(category_repo))),
                app_data_dir: app_data_dir.clone(),
                llama_server_child: Arc::new(Mutex::new(llama_child)),
                worker_child: Arc::new(Mutex::new(worker_child)),
            });

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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
