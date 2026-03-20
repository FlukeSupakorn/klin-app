use serde::{Deserialize, Serialize};

use crate::domain::entities::{AutomationLog, Category, RuleMapping};

#[derive(Serialize)]
pub struct NoteFileEntryDto {
    pub path: String,
    pub file_name: String,
    pub size_bytes: u64,
    pub last_modified_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AutomationConfigDto {
    pub auto_organize_enabled: bool,
    pub watched_folders: Vec<String>,
    pub scan_interval_seconds: u64,
}

impl Default for AutomationConfigDto {
    fn default() -> Self {
        Self {
            auto_organize_enabled: false,
            watched_folders: Vec::new(),
            scan_interval_seconds: 60,
        }
    }
}

#[derive(Serialize)]
pub struct SubdirEntry {
    pub name: String,
    pub path: String,
    pub has_children: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MoveFileDto {
    pub source_path: String,
    pub destination_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReadFolderDto {
    pub folder_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WatchFolderDto {
    pub folder_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WriteLogDto {
    pub log: AutomationLog,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveRuleMappingDto {
    pub mappings: Vec<RuleMapping>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CategoryDto {
    pub id: String,
    pub name: String,
    pub system_generated: bool,
    pub active: bool,
}

impl From<Category> for CategoryDto {
    fn from(value: Category) -> Self {
        Self {
            id: value.id,
            name: value.name,
            system_generated: value.system_generated,
            active: value.active,
        }
    }
}
