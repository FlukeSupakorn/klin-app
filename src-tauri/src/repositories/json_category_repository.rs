use std::path::PathBuf;

use crate::domain::{entities::Category, repository_traits::CategoryRepository};

pub struct JsonCategoryRepository {
    file_path: PathBuf,
}

impl JsonCategoryRepository {
    pub fn new(file_path: PathBuf) -> Self {
        Self { file_path }
    }

    fn default_categories() -> Vec<Category> {
        vec![
            Category {
                id: "finance".to_string(),
                name: "Finance".to_string(),
                system_generated: true,
                active: true,
            },
            Category {
                id: "work".to_string(),
                name: "Work".to_string(),
                system_generated: true,
                active: true,
            },
            Category {
                id: "personal".to_string(),
                name: "Personal".to_string(),
                system_generated: true,
                active: true,
            },
        ]
    }
}

impl CategoryRepository for JsonCategoryRepository {
    fn list_categories(&self) -> Result<Vec<Category>, String> {
        if !self.file_path.exists() {
            return Ok(Self::default_categories());
        }

        let content = std::fs::read_to_string(&self.file_path)
            .map_err(|err| format!("read categories failed: {err}"))?;

        if content.trim().is_empty() {
            return Ok(Self::default_categories());
        }

        serde_json::from_str::<Vec<Category>>(&content)
            .map_err(|err| format!("parse categories failed: {err}"))
    }
}
