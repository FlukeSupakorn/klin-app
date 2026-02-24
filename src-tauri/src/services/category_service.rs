use crate::domain::{entities::Category, repository_traits::CategoryRepository};

pub struct CategoryService<R: CategoryRepository> {
    repository: R,
}

impl<R: CategoryRepository> CategoryService<R> {
    pub fn new(repository: R) -> Self {
        Self { repository }
    }

    pub fn list_categories(&self) -> Result<Vec<Category>, String> {
        self.repository.list_categories()
    }
}
