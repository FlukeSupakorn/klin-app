/**
 * Single source of truth for dev-only UI gating.
 *
 * Vite replaces `import.meta.env.DEV` with a literal `true` (vite dev / tauri dev)
 * or `false` (vite build / tauri build) at compile time, so any block guarded by
 * IS_DEV is dead-code-eliminated from production bundles.
 *
 * If anything ever shows up in prod that shouldn't, flip this constant to `false`
 * unconditionally to verify the gating is wired correctly.
 */
export const IS_DEV = import.meta.env.DEV;
