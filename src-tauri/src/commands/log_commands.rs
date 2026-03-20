use tauri::State;

use crate::{dto::WriteLogDto, AppState};

#[tauri::command]
pub fn write_log(state: State<AppState>, input: WriteLogDto) -> Result<(), String> {
    state.log_service.lock().write_log(input.log)
}

#[tauri::command]
pub fn list_logs(
    state: State<AppState>,
) -> Result<Vec<crate::domain::entities::AutomationLog>, String> {
    state.log_service.lock().list_logs()
}
