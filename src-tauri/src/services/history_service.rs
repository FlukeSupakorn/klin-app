use crate::domain::{entities::AutomationLog, repository_traits::HistoryRepository};

pub struct HistoryService<R: HistoryRepository> {
    repository: R,
}

impl<R: HistoryRepository> HistoryService<R> {
    pub fn new(repository: R) -> Self {
        Self { repository }
    }

    pub fn write_history(&mut self, log: AutomationLog) -> Result<(), String> {
        self.repository.append(log)
    }

    pub fn list_history(&self) -> Result<Vec<AutomationLog>, String> {
        self.repository.list()
    }
}
