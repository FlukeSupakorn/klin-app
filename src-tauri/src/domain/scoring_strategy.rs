pub trait ScoringStrategy: Send + Sync {
    fn provider_name(&self) -> &'static str;
}

pub struct FrontendOwnedScoringStrategy;

impl ScoringStrategy for FrontendOwnedScoringStrategy {
    fn provider_name(&self) -> &'static str {
        "frontend-owned"
    }
}
