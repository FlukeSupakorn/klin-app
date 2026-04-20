use crate::domain::entities::{AutomationLog, Category, RuleMapping};

pub trait HistoryRepository: Send + Sync {
    fn append(&mut self, log: AutomationLog) -> Result<(), String>;
    fn list(&self) -> Result<Vec<AutomationLog>, String>;
}

impl<T: HistoryRepository + ?Sized> HistoryRepository for Box<T> {
    fn append(&mut self, log: AutomationLog) -> Result<(), String> {
        (**self).append(log)
    }

    fn list(&self) -> Result<Vec<AutomationLog>, String> {
        (**self).list()
    }
}

pub trait RuleRepository: Send + Sync {
    fn save_mappings(&mut self, mappings: Vec<RuleMapping>) -> Result<(), String>;
    fn list_mappings(&self) -> Result<Vec<RuleMapping>, String>;
}

impl<T: RuleRepository + ?Sized> RuleRepository for Box<T> {
    fn save_mappings(&mut self, mappings: Vec<RuleMapping>) -> Result<(), String> {
        (**self).save_mappings(mappings)
    }

    fn list_mappings(&self) -> Result<Vec<RuleMapping>, String> {
        (**self).list_mappings()
    }
}

pub trait CategoryRepository: Send + Sync {
    fn list_categories(&self) -> Result<Vec<Category>, String>;
}

impl<T: CategoryRepository + ?Sized> CategoryRepository for Box<T> {
    fn list_categories(&self) -> Result<Vec<Category>, String> {
        (**self).list_categories()
    }
}

pub trait AutomationConfigRepository: Send + Sync {
    fn save(&self, config: &crate::domain::dto::AutomationConfigDto) -> Result<(), String>;
    fn load(&self) -> Result<crate::domain::dto::AutomationConfigDto, String>;
}
