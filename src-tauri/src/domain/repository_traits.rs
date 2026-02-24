use crate::domain::entities::{AutomationLog, Category, RuleMapping};

pub trait LogRepository: Send + Sync {
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
