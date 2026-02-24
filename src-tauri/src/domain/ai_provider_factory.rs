use crate::domain::scoring_strategy::{FrontendOwnedScoringStrategy, ScoringStrategy};

pub enum AiProvider {
    Frontend,
}

pub struct ScoringProviderFactory;

impl ScoringProviderFactory {
    pub fn create(_provider: AiProvider) -> Box<dyn ScoringStrategy> {
        Box::new(FrontendOwnedScoringStrategy)
    }
}
