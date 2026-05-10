// Onboarding completion is tracked in two places:
//   1. localStorage key "klin.onboarding-completed" — primary persistent flag,
//      written when the user finishes the onboarding flow and read on launch.
//   2. The worker's /health endpoint (onboarding_status field) — fallback for
//      first-ever launches and for upgrade-from-older-build auto-heal.
// See src/features/onboarding/onboarding-guard.tsx for the read/retry logic.
// VITE_SKIP_ONBOARDING=true  →  skip the onboarding check entirely (dev only)
export {};
