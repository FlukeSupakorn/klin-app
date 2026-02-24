use crate::domain::{entities::AutomationLog, repository_traits::LogRepository};

pub struct LogService<R: LogRepository> {
    repository: R,
}

impl<R: LogRepository> LogService<R> {
    pub fn new(repository: R) -> Self {
        Self { repository }
    }

    pub fn write_log(&mut self, log: AutomationLog) -> Result<(), String> {
        self.repository.append(log)
    }

    pub fn list_logs(&self) -> Result<Vec<AutomationLog>, String> {
        self.repository.list()
    }
}
