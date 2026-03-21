use tauri::State;

use crate::{
    domain::dto::AutomationConfigDto,
    domain::repository_traits::AutomationConfigRepository,
    AppState,
};

#[tauri::command]
pub fn save_automation_config(
    state: State<AppState>,
    config: AutomationConfigDto,
) -> Result<(), String> {
    state.automation_config_repository.save(&config)
}

#[tauri::command]
pub fn load_automation_config(
    state: State<AppState>,
) -> Result<AutomationConfigDto, String> {
    state.automation_config_repository.load()
}
