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
    tracing::info!(
        "[automation] save config: enabled={}, watched_folders={}",
        config.auto_organize_enabled,
        config.watched_folders.len()
    );
    state.automation_config_repository.save(&config)?;

    // Always register watchers; auto-organize gating happens in the frontend
    // handler so users still see "new file detected" notices when off.
    for folder in config.watched_folders {
        tracing::info!("[automation] register watcher for {}", folder);
        FileService::watch_folder(app.clone(), folder)?;
    }

    Ok(())
}

#[tauri::command]
pub fn load_automation_config(state: State<AppState>) -> Result<AutomationConfigDto, String> {
    state.automation_config_repository.load()
}
