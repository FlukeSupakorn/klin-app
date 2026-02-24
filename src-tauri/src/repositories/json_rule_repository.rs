use std::path::PathBuf;

use crate::domain::{entities::RuleMapping, repository_traits::RuleRepository};

pub struct JsonRuleRepository {
    file_path: PathBuf,
}

impl JsonRuleRepository {
    pub fn new(file_path: PathBuf) -> Self {
        Self { file_path }
    }

    fn read_all(&self) -> Result<Vec<RuleMapping>, String> {
        if !self.file_path.exists() {
            return Ok(Vec::new());
        }

        let content = std::fs::read_to_string(&self.file_path)
            .map_err(|err| format!("read rules failed: {err}"))?;

        if content.trim().is_empty() {
            return Ok(Vec::new());
        }

        serde_json::from_str::<Vec<RuleMapping>>(&content)
            .map_err(|err| format!("parse rules failed: {err}"))
    }

    fn write_all(&self, mappings: &[RuleMapping]) -> Result<(), String> {
        let content = serde_json::to_string_pretty(mappings)
            .map_err(|err| format!("serialize rules failed: {err}"))?;
        std::fs::write(&self.file_path, content).map_err(|err| format!("write rules failed: {err}"))
    }
}

impl RuleRepository for JsonRuleRepository {
    fn save_mappings(&mut self, mappings: Vec<RuleMapping>) -> Result<(), String> {
        self.write_all(&mappings)
    }

    fn list_mappings(&self) -> Result<Vec<RuleMapping>, String> {
        self.read_all()
    }
}
