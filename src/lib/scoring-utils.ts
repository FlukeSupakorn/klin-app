/**
 * Scoring utility functions for normalizing and processing category scores
 */

import type { CategoryScore } from "@/types/domain";

/**
 * Normalize a single score value to be between 0 and 1
 * - If value <= 0 or not finite: returns 0
 * - If value > 1: assumes it's a percentage (e.g., 95 = 95%), converts to decimal
 * - Otherwise: returns the value as-is
 */
export function normalizeScore(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }

  if (value > 1) {
    return Number((value / 100).toFixed(4));
  }

  return Number(value.toFixed(4));
}

/**
 * Normalize a list of category scores so they sum to a distribution (0.0 to 1.0)
 * If all scores are 0, distributes evenly across categories
 */
export function normalizeScoreDistribution(scores: CategoryScore[]): CategoryScore[] {
  const total = scores.reduce((sum, item) => sum + item.score, 0);
  if (total === 0) {
    const even = 1 / Math.max(scores.length, 1);
    return scores.map((item) => ({ ...item, score: Number(even.toFixed(4)) }));
  }
  return scores.map((item) => ({
    ...item,
    score: Number((item.score / total).toFixed(4)),
  }));
}

/**
 * Parse and normalize scores from API response data
 * Returns normalized category scores sorted by score (descending)
 */
export function parseNormalizedScores(input: unknown): CategoryScore[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const name = "name" in item ? String(item.name ?? "") : "";
      const score = "score" in item ? Number(item.score) : Number.NaN;
      if (!name) {
        return null;
      }

      return { name, score: normalizeScore(score) };
    })
    .filter((item): item is CategoryScore => item !== null)
    .sort((a, b) => b.score - a.score);
}
