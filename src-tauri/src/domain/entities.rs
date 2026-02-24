use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CategoryScore {
    pub name: String,
    pub score: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AutomationLog {
    pub id: String,
    pub file_name: String,
    pub original_path: String,
    pub moved_to: String,
    pub chosen_category: String,
    pub score: f64,
    pub all_scores: Vec<CategoryScore>,
    pub timestamp: String,
    pub processing_time_ms: i64,
    pub status: String,
    pub error_message: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RuleMapping {
    pub category_name: String,
    pub folder_path: String,
    pub is_active: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Category {
    pub id: String,
    pub name: String,
    pub system_generated: bool,
    pub active: bool,
}
