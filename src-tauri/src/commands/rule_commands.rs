use tauri::State;

use crate::{
    domain::dto::{CategoryDto, SaveRuleMappingDto},
    AppState,
};

#[tauri::command]
pub fn get_categories(state: State<AppState>) -> Result<Vec<CategoryDto>, String> {
    state
        .category_service
        .lock()
        .list_categories()
        .map(|categories| categories.into_iter().map(CategoryDto::from).collect())
}

#[tauri::command]
pub fn save_rule_mapping(state: State<AppState>, input: SaveRuleMappingDto) -> Result<(), String> {
    state.rule_service.lock().save_mappings(input.mappings)
}
