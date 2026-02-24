use serde::{Deserialize, Serialize};

use crate::domain::entities::{AutomationLog, Category, RuleMapping};

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
