pub trait ScoringStrategy: Send + Sync {
    fn provider_name(&self) -> &'static str;
}

pub struct FrontendOwnedScoringStrategy;

impl ScoringStrategy for FrontendOwnedScoringStrategy {
    fn provider_name(&self) -> &'static str {
        "frontend-owned"
    }
}

pub enum AiProvider {
    Frontend,
}

pub struct ScoringProviderFactory;

impl ScoringProviderFactory {
    pub fn create(_provider: AiProvider) -> Box<dyn ScoringStrategy> {
        Box::new(FrontendOwnedScoringStrategy)
    }
}
