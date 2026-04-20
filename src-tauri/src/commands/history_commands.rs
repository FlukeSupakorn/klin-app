use tauri::State;

use crate::{domain::dto::WriteHistoryDto, AppState};

#[tauri::command]
pub fn write_history(state: State<AppState>, input: WriteHistoryDto) -> Result<(), String> {
    state.history_service.lock().write_history(input.log)
}

#[tauri::command]
pub fn list_history(
    state: State<AppState>,
) -> Result<Vec<crate::domain::entities::AutomationLog>, String> {
    state.history_service.lock().list_history()
}
