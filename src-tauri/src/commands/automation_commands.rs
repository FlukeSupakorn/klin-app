use tauri::State;

use crate::{
    domain::dto::AutomationConfigDto, domain::repository_traits::AutomationConfigRepository,
    services::file_service::FileService, AppState,
};

#[tauri::command]
pub fn save_automation_config<R: tauri::Runtime>(
    app: tauri::AppHandle<R>,
    state: State<AppState>,
    config: AutomationConfigDto,
) -> Result<(), String> {
    eprintln!(
        "[automation] save config: enabled={}, watched_folders={}",
        config.auto_organize_enabled,
        config.watched_folders.len()
    );
    state.automation_config_repository.save(&config)?;

    if config.auto_organize_enabled {
        for folder in config.watched_folders {
            eprintln!("[automation] register watcher for {}", folder);
            FileService::watch_folder(app.clone(), folder)?;
        }
    }

    Ok(())
}

#[tauri::command]
pub fn load_automation_config(state: State<AppState>) -> Result<AutomationConfigDto, String> {
    state.automation_config_repository.load()
}
