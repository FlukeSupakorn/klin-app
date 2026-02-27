mod commands;
mod domain;
mod dto;
mod infrastructure;
mod repositories;
mod services;

use std::sync::Arc;

use parking_lot::Mutex;
use tauri::Manager;
use repositories::{json_category_repository::JsonCategoryRepository, json_log_repository::JsonLogRepository, json_rule_repository::JsonRuleRepository};
use services::{category_service::CategoryService, log_service::LogService, rule_service::RuleService};

pub struct AppState {
    pub log_service: Arc<Mutex<LogService<JsonLogRepository>>>,
    pub rule_service: Arc<Mutex<RuleService<JsonRuleRepository>>>,
    pub category_service: Arc<Mutex<CategoryService<JsonCategoryRepository>>>,
}

pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let app_data_dir = infrastructure::app_paths::resolve_app_data_dir(app.handle())?;
            std::fs::create_dir_all(&app_data_dir)?;

            let log_repo = JsonLogRepository::new(app_data_dir.join("logs.json"));
            let rule_repo = JsonRuleRepository::new(app_data_dir.join("rules.json"));
            let category_repo = JsonCategoryRepository::new(app_data_dir.join("categories.json"));

            app.manage(AppState {
                log_service: Arc::new(Mutex::new(LogService::new(log_repo))),
                rule_service: Arc::new(Mutex::new(RuleService::new(rule_repo))),
                category_service: Arc::new(Mutex::new(CategoryService::new(category_repo))),
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
            commands::write_log,
            commands::list_logs,
            commands::get_categories,
            commands::save_rule_mapping,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
