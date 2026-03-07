mod commands;
mod domain;
mod dto;
mod infrastructure;
mod repositories;
mod services;

use std::sync::Arc;
use std::time::Duration;

use parking_lot::Mutex;
use tauri::{Emitter, Manager};
use tauri_plugin_deep_link::DeepLinkExt;
use tauri_plugin_shell::{process::CommandEvent, ShellExt};
use repositories::{json_category_repository::JsonCategoryRepository, json_log_repository::JsonLogRepository, json_rule_repository::JsonRuleRepository};
use services::{category_service::CategoryService, log_service::LogService, rule_service::RuleService};

pub struct AppState {
    pub log_service: Arc<Mutex<LogService<JsonLogRepository>>>,
    pub rule_service: Arc<Mutex<RuleService<JsonRuleRepository>>>,
    pub category_service: Arc<Mutex<CategoryService<JsonCategoryRepository>>>,
}

pub fn run() {
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
            let app_data_dir_arg = app_data_dir.to_string_lossy().to_string();
            std::fs::create_dir_all(&app_data_dir)?;

            let sidecar_cmd = app
                .shell()
                .sidecar("klin-worker")?
                .env("KLIN_APP_DATA_DIR", app_data_dir_arg.clone())
                .args([
                    "--host",
                    "127.0.0.1",
                    "--port",
                    "8000",
                    "--data-dir",
                    app_data_dir_arg.as_str(),
                ]);

            let (mut rx, _worker_child) = sidecar_cmd.spawn()?;
            tauri::async_runtime::spawn(async move {
                while let Some(event) = rx.recv().await {
                    match event {
                        CommandEvent::Stdout(line) => {
                            eprintln!("[klin-worker] {}", String::from_utf8_lossy(&line));
                        }
                        CommandEvent::Stderr(line) => {
                            eprintln!("[klin-worker][stderr] {}", String::from_utf8_lossy(&line));
                        }
                        _ => {}
                    }
                }
            });

            let log_repo = JsonLogRepository::new(app_data_dir.join("logs.json"));
            let rule_repo = JsonRuleRepository::new(app_data_dir.join("rules.json"));
            let category_repo = JsonCategoryRepository::new(app_data_dir.join("categories.json"));

            app.manage(AppState {
                log_service: Arc::new(Mutex::new(LogService::new(log_repo))),
                rule_service: Arc::new(Mutex::new(RuleService::new(rule_repo))),
                category_service: Arc::new(Mutex::new(CategoryService::new(category_repo))),
            });

            #[cfg(any(windows, target_os = "linux"))]
            {
                app.deep_link().register("klin")?;
            }

            let handle = app.handle().clone();
            app.deep_link().on_open_url(move |event| {
                if let Some(url) = event.urls().iter().find(|url| url.as_str().starts_with("klin://auth")) {
                    let _ = handle.emit("deep-link://oauth-callback", url.to_string());
                }
            });

            if let Some(main_window) = app.get_webview_window("main") {
                let close_window = main_window.clone();
                main_window.on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                        api.prevent_close();
                        let _ = close_window.hide();
                    }
                });
            }

            let scanner_app_handle = app.handle().clone();
            std::thread::spawn(move || {
                let mut previous_has_files = false;

                loop {
                    std::thread::sleep(Duration::from_secs(60));

                    let config = match commands::load_automation_config(scanner_app_handle.clone()) {
                        Ok(config) => config,
                        Err(_) => continue,
                    };

                    if !config.auto_organize_enabled || config.watched_folders.is_empty() {
                        previous_has_files = false;
                        continue;
                    }

                    let has_files = config
                        .watched_folders
                        .iter()
                        .any(|folder| {
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
