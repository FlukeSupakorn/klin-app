mod commands;
mod domain;
mod infrastructure;
mod repositories;
mod services;
mod sidecars;

use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;

use parking_lot::Mutex;
use tauri::{Emitter, Manager};
#[cfg(windows)]
use tauri_plugin_deep_link::DeepLinkExt;
use tauri_plugin_shell::process::CommandChild;

use domain::repository_traits::AutomationConfigRepository;
use domain::repository_traits::{CategoryRepository, HistoryRepository, RuleRepository};
use repositories::{
    json_automation_config_repository::JsonAutomationConfigRepository,
    json_category_repository::JsonCategoryRepository,
    json_history_repository::JsonHistoryRepository, json_rule_repository::JsonRuleRepository,
};
use services::{
    category_service::CategoryService, history_service::HistoryService, rule_service::RuleService,
};
use sidecars::{LlamaSlotState, ModelSlot};

type DynHistoryRepository = Box<dyn HistoryRepository>;
type DynRuleRepository = Box<dyn RuleRepository>;
type DynCategoryRepository = Box<dyn CategoryRepository>;

// ── App State ───────────────────────────────────────────────────────────

pub struct AppState {
    pub history_service: Arc<Mutex<HistoryService<DynHistoryRepository>>>,
    pub rule_service: Arc<Mutex<RuleService<DynRuleRepository>>>,
    pub category_service: Arc<Mutex<CategoryService<DynCategoryRepository>>>,
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
    infrastructure::runtime_env::get_bool(name)
}

// ── Setup helpers ────────────────────────────────────────────────────────

fn setup_worker<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    app_data_dir: &PathBuf,
) -> Option<CommandChild> {
    if env_flag("KLIN_WORKER_EXTERNAL") {
        tracing::info!("[startup] klin-worker: external mode enabled, skipping sidecar spawn");
        return None;
    }
    let app_data_dir_str = app_data_dir.to_string_lossy().to_string();
    match sidecars::spawn_klin_worker(app, &app_data_dir_str) {
        Ok(child) => Some(child),
        Err(e) => {
            tracing::info!("[startup] klin-worker: {}", e);
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
    #[cfg(windows)]
    {
        app.deep_link().register("klin")?;

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
    }

    Ok(())
}

fn setup_window_behavior<R: tauri::Runtime>(app: &tauri::App<R>) {
    if let Some(main_window) = app.get_webview_window("main") {
        let close_window = main_window.clone();
        main_window.on_window_event(move |event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                tracing::info!("[tray] close requested intercepted; opening close-to-tray prompt");
                let _ = close_window.emit("window://close-requested", ());
            }
        });
    }
}

fn setup_configured_watchers<R: tauri::Runtime>(
    app_handle: tauri::AppHandle<R>,
    config_repo: Arc<JsonAutomationConfigRepository>,
) {
    let config = match config_repo.load() {
        Ok(config) => config,
        Err(err) => {
            tracing::info!(
                "[startup] failed to load automation config; using defaults: {}",
                err
            );
            Default::default()
        }
    };
    tracing::info!(
        "[startup] automation config: enabled={}, watched_folders={} ",
        config.auto_organize_enabled,
        config.watched_folders.len()
    );

    if !config.auto_organize_enabled {
        tracing::info!("[startup] watcher registration skipped: auto organize disabled");
        return;
    }

    for folder in config.watched_folders {
        tracing::info!("[startup] registering watcher for {}", folder);
        if let Err(err) =
            services::file_service::FileService::watch_folder(app_handle.clone(), folder)
        {
            tracing::info!("[startup] watcher setup failed: {}", err);
        }
    }
}

fn cleanup_orphaned_llama_servers() {
    #[cfg(target_os = "windows")]
    {
        use std::process::Command;

        tracing::info!("[startup] checking for orphaned llama-server processes...");
        let output = Command::new("tasklist")
            .args(&["/FI", "IMAGENAME eq llama-server.exe"])
            .output();

        if let Ok(output) = output {
            let stdout = String::from_utf8_lossy(&output.stdout);
            // If llama-server appears in tasklist, kill it
            if stdout.contains("llama-server.exe") {
                tracing::info!("[startup] found orphaned llama-server, cleaning up...");
                let _ = Command::new("taskkill")
                    .args(&["/IM", "llama-server.exe", "/F", "/T"])
                    .output();
                tracing::info!("[startup] orphaned llama-server cleaned up");
            }
        }
    }
}

// ── App Entry Point ─────────────────────────────────────────────────────

pub fn run() {
    infrastructure::logging::init_logging();

    // Load .env file (silently ignore if not found)
    let loaded = infrastructure::runtime_env::preload_process_env();
    let resolved_chat = infrastructure::runtime_env::get("KLIN_CHAT_MODEL_PATH");
    let resolved_embed = infrastructure::runtime_env::get("KLIN_EMBED_MODEL_PATH");
    tracing::info!(
        "[startup] env: path={}, loaded={}, chat_model={:?}, embed_model={:?}, worker_external={}",
        infrastructure::runtime_env::app_env_path_string(),
        loaded,
        resolved_chat,
        resolved_embed,
        env_flag("KLIN_WORKER_EXTERNAL"),
    );

    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            if let Some(main_window) = app.get_webview_window("main") {
                tracing::info!("[tray] restore requested (single-instance activation)");
                let _ = main_window.show();
                let _ = main_window.set_focus();
                tracing::info!("[tray] tray mode closed (main window visible)");
            }

            if let Some(url) = argv.iter().find(|arg| arg.starts_with("klin://auth")) {
                let _ = app.emit("deep-link://oauth-callback", url.clone());
            }
        }))
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let app_data_dir = infrastructure::app_paths::resolve_app_data_dir(app.handle())?;
            infrastructure::runtime_env::set_app_data_dir(app_data_dir.clone());
            std::fs::create_dir_all(&app_data_dir)?;

            // ── Clean up orphaned processes ──────────────────────────
            cleanup_orphaned_llama_servers();

            // ── Spawn sidecars ──────────────────────────────────────
            tracing::info!("[startup] llama-server: lazy startup enabled (multi-slot)");
            let worker_child = setup_worker(app.handle(), &app_data_dir);

            // ── Repositories & services ─────────────────────────────
            let history_repo = JsonHistoryRepository::new(app_data_dir.join("history.json"));
            let rule_repo = JsonRuleRepository::new(app_data_dir.join("rules.json"));
            let category_repo = JsonCategoryRepository::new(app_data_dir.join("categories.json"));
            let config_repo = Arc::new(JsonAutomationConfigRepository::new(
                app_data_dir.join("automation-config.json"),
            ));

            // ── Llama-server slots ──────────────────────────────────
            let slots = setup_llama_slots();

            let app_state = AppState {
                history_service: Arc::new(Mutex::new(HistoryService::new(Box::new(history_repo)))),
                rule_service: Arc::new(Mutex::new(RuleService::new(Box::new(rule_repo)))),
                category_service: Arc::new(Mutex::new(CategoryService::new(Box::new(
                    category_repo,
                )))),
                app_data_dir: app_data_dir.clone(),
                slots,
                worker_child: Arc::new(Mutex::new(worker_child)),
                automation_config_repository: config_repo.clone(),
            };

            app.manage(app_state);

            // ── Deep links ──────────────────────────────────────────
            setup_deep_links(app)?;

            // ── Window close → hide ─────────────────────────────────
            setup_window_behavior(app);

            // ── Event-driven watcher startup ───────────────────────
            setup_configured_watchers(app.handle().clone(), config_repo);

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::exit_app,
            commands::minimize_to_tray,
            commands::watch_folder,
            commands::move_file,
            commands::read_folder,
            commands::ensure_llama_server,
            commands::stop_llama_server,
            commands::touch_llama_server,
            commands::warmup_chat_model,
            commands::pick_files_for_organize,
            commands::pick_folder_for_organize,
            commands::save_note_file,
            commands::open_external_url,
            commands::delete_file,
            commands::get_downloads_folder,
            commands::get_app_data_dir,
            commands::list_note_files,
            commands::read_note_file,
            commands::write_history,
            commands::list_history,
            commands::get_categories,
            commands::save_rule_mapping,
            commands::start_oauth_listener,
            commands::save_automation_config,
            commands::load_automation_config,
            commands::pick_folders_for_batch,
            commands::list_subdirectories,
            commands::list_all_subdirectories,
            commands::ensure_category_folders,
            commands::write_text_file,
            commands::stat_files,
            commands::log_frontend,
            commands::download_model,
            commands::cancel_model_download,
            commands::get_model_dir,
            commands::read_model_config,
            commands::write_model_config,
            commands::list_installed_models,
            commands::get_system_specs,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| {
            if matches!(
                event,
                tauri::RunEvent::ExitRequested { .. } | tauri::RunEvent::Exit
            ) {
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
