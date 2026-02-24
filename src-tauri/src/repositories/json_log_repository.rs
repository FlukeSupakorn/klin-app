use std::path::PathBuf;

use crate::domain::{entities::AutomationLog, repository_traits::LogRepository};

pub struct JsonLogRepository {
    file_path: PathBuf,
}

impl JsonLogRepository {
    pub fn new(file_path: PathBuf) -> Self {
        Self { file_path }
    }

    fn read_all(&self) -> Result<Vec<AutomationLog>, String> {
        if !self.file_path.exists() {
            return Ok(Vec::new());
        }

        let content = std::fs::read_to_string(&self.file_path)
            .map_err(|err| format!("read logs failed: {err}"))?;

        if content.trim().is_empty() {
            return Ok(Vec::new());
        }

        serde_json::from_str::<Vec<AutomationLog>>(&content)
            .map_err(|err| format!("parse logs failed: {err}"))
    }

    fn write_all(&self, logs: &[AutomationLog]) -> Result<(), String> {
        let content = serde_json::to_string_pretty(logs)
            .map_err(|err| format!("serialize logs failed: {err}"))?;
        std::fs::write(&self.file_path, content).map_err(|err| format!("write logs failed: {err}"))
    }
}

impl LogRepository for JsonLogRepository {
    fn append(&mut self, log: AutomationLog) -> Result<(), String> {
        let mut current = self.read_all()?;
        current.push(log);
        self.write_all(&current)
    }

    fn list(&self) -> Result<Vec<AutomationLog>, String> {
        self.read_all()
    }
}
