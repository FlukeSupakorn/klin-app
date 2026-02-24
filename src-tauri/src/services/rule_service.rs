use crate::domain::{entities::RuleMapping, repository_traits::RuleRepository};

pub struct RuleService<R: RuleRepository> {
    repository: R,
}

impl<R: RuleRepository> RuleService<R> {
    pub fn new(repository: R) -> Self {
        Self { repository }
    }

    pub fn save_mappings(&mut self, mappings: Vec<RuleMapping>) -> Result<(), String> {
        self.repository.save_mappings(mappings)
    }

    pub fn list_mappings(&self) -> Result<Vec<RuleMapping>, String> {
        self.repository.list_mappings()
    }
}
