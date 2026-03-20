use std::path::PathBuf;

use crate::domain::repository_traits::AutomationConfigRepository;
use crate::dto::AutomationConfigDto;

pub struct JsonAutomationConfigRepository {
    path: PathBuf,
}

impl JsonAutomationConfigRepository {
    pub fn new(path: PathBuf) -> Self {
        Self { path }
    }
}

impl AutomationConfigRepository for JsonAutomationConfigRepository {
    fn save(&self, config: &AutomationConfigDto) -> Result<(), String> {
        if let Some(parent) = self.path.parent() {
            std::fs::create_dir_all(parent).map_err(|err| err.to_string())?;
        }
        let json = serde_json::to_string_pretty(config).map_err(|err| err.to_string())?;
        std::fs::write(&self.path, json).map_err(|err| err.to_string())
    }

    fn load(&self) -> Result<AutomationConfigDto, String> {
        if !self.path.exists() {
            return Ok(AutomationConfigDto::default());
        }
        let json = std::fs::read_to_string(&self.path).map_err(|err| err.to_string())?;
        serde_json::from_str::<AutomationConfigDto>(&json).map_err(|err| err.to_string())
    }
}
