mod commands;
mod domain;
mod dto;
mod infrastructure;
mod repositories;
mod services;
mod sidecars;

use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use std::time::Duration;

use parking_lot::Mutex;
use tauri::{Emitter, Manager};
use tauri_plugin_deep_link::DeepLinkExt;
use tauri_plugin_shell::process::CommandChild;

use domain::repository_traits::AutomationConfigRepository;
use repositories::{
    json_automation_config_repository::JsonAutomationConfigRepository,
    json_category_repository::JsonCategoryRepository,
    json_log_repository::JsonLogRepository,
    json_rule_repository::JsonRuleRepository,
};
use services::{
    category_service::CategoryService, log_service::LogService, rule_service::RuleService,
};
use sidecars::{LlamaSlotState, ModelSlot};

// ── App State ───────────────────────────────────────────────────────────

pub struct AppState {
    pub log_service: Arc<Mutex<LogService<JsonLogRepository>>>,
    pub rule_service: Arc<Mutex<RuleService<JsonRuleRepository>>>,
    pub category_service: Arc<Mutex<CategoryService<JsonCategoryRepository>>>,
    pub app_data_dir: PathBuf,
    /// Per-slot llama-server lifecycle state.
    pub slots: HashMap<ModelSlot, LlamaSlotState>,
    pub worker_child: Arc<Mutex<Option<CommandChild>>>,
    pub automation_config_repository: Arc<JsonAutomationConfigRepository>,
}

impl AppState {
    /// Get the slot state for the given model slot.
    pub fn slot(&self, s: ModelSlot) -> &LlamaSlotState {
        self.slots.get(&s).expect("unknown model slot")
    }
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

// ── Setup helpers ────────────────────────────────────────────────────────

fn setup_worker<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    app_data_dir: &PathBuf,
) -> Option<CommandChild> {
    if env_flag("KLIN_WORKER_EXTERNAL") {
        eprintln!("[startup] klin-worker: external mode enabled, skipping sidecar spawn");
        return None;
    }
    let app_data_dir_str = app_data_dir.to_string_lossy().to_string();
    match sidecars::spawn_klin_worker(app, &app_data_dir_str) {
        Ok(child) => Some(child),
        Err(e) => {
            eprintln!("[startup] klin-worker: {}", e);
            None
        }
    }
}

fn setup_llama_slots() -> HashMap<ModelSlot, LlamaSlotState> {
    let mut slots = HashMap::new();
    for s in [ModelSlot::Chat, ModelSlot::Embed] {
        let slot_state = LlamaSlotState::new(s);
        sidecars::spawn_idle_timeout_task_for_slot(&slot_state);
        slots.insert(s, slot_state);
    }
    slots
}

fn setup_deep_links<R: tauri::Runtime>(
    app: &tauri::App<R>,
) -> Result<(), Box<dyn std::error::Error>> {
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

    Ok(())
}

fn setup_window_behavior<R: tauri::Runtime>(app: &tauri::App<R>) {
    if let Some(main_window) = app.get_webview_window("main") {
        let close_window = main_window.clone();
        main_window.on_window_event(move |event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = close_window.hide();
            }
        });
    }
}

fn setup_background_scanner<R: tauri::Runtime>(
    app_handle: tauri::AppHandle<R>,
    config_repo: Arc<JsonAutomationConfigRepository>,
) {
    std::thread::spawn(move || {
        let mut previous_has_files = false;

        loop {
            std::thread::sleep(Duration::from_secs(60));

            let config = config_repo.load().unwrap_or_default();

            if !config.auto_organize_enabled || config.watched_folders.is_empty() {
                previous_has_files = false;
                continue;
            }

            let has_files = config.watched_folders.iter().any(|folder: &String| {
                services::file_service::FileService::read_folder(folder.clone())
                    .map(|files| !files.is_empty())
                    .unwrap_or(false)
            });

            if has_files && !previous_has_files {
                if let Some(main_window) = app_handle.get_webview_window("main") {
                    let _ = main_window.show();
                    let _ = main_window.set_focus();
                }
            }

            previous_has_files = has_files;
        }
    });
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
            std::fs::create_dir_all(&app_data_dir)?;

            // ── Spawn sidecars ──────────────────────────────────────
            eprintln!("[startup] llama-server: lazy startup enabled (multi-slot)");
            let worker_child = setup_worker(app.handle(), &app_data_dir);

            // ── Repositories & services ─────────────────────────────
            let log_repo = JsonLogRepository::new(app_data_dir.join("logs.json"));
            let rule_repo = JsonRuleRepository::new(app_data_dir.join("rules.json"));
            let category_repo = JsonCategoryRepository::new(app_data_dir.join("categories.json"));
            let config_repo = Arc::new(JsonAutomationConfigRepository::new(
                app_data_dir.join("automation-config.json"),
            ));

            // ── Llama-server slots ──────────────────────────────────
            let slots = setup_llama_slots();

            app.manage(AppState {
                log_service: Arc::new(Mutex::new(LogService::new(log_repo))),
                rule_service: Arc::new(Mutex::new(RuleService::new(rule_repo))),
                category_service: Arc::new(Mutex::new(CategoryService::new(category_repo))),
                app_data_dir: app_data_dir.clone(),
                slots,
                worker_child: Arc::new(Mutex::new(worker_child)),
                automation_config_repository: config_repo.clone(),
            });

            // ── Deep links ──────────────────────────────────────────
            setup_deep_links(app)?;

            // ── Window close → hide ─────────────────────────────────
            setup_window_behavior(app);

            // ── Background folder scanner ───────────────────────────
            setup_background_scanner(app.handle().clone(), config_repo);

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
                // Signal all idle-timeout threads to exit cleanly.
                let state = app.state::<AppState>();
                for slot_state in state.slots.values() {
                    *slot_state.idle_shutdown.lock() = true;
                    slot_state.shutdown_condvar.notify_all();
                }

                sidecars::cleanup_all(app);
            }
        });
}
