use crate::domain::entities::{AutomationLog, Category, RuleMapping};

pub trait HistoryRepository: Send + Sync {
    fn append(&mut self, log: AutomationLog) -> Result<(), String>;
    fn list(&self) -> Result<Vec<AutomationLog>, String>;
}

pub trait RuleRepository: Send + Sync {
    fn save_mappings(&mut self, mappings: Vec<RuleMapping>) -> Result<(), String>;
    fn list_mappings(&self) -> Result<Vec<RuleMapping>, String>;
}

pub trait CategoryRepository: Send + Sync {
    fn list_categories(&self) -> Result<Vec<Category>, String>;
}

pub trait AutomationConfigRepository: Send + Sync {
    fn save(&self, config: &crate::domain::dto::AutomationConfigDto) -> Result<(), String>;
    fn load(&self) -> Result<crate::domain::dto::AutomationConfigDto, String>;
}
