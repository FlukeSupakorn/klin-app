import { describe, it, expect } from "bun:test";
import {
  normalizeScore,
  normalizeScoreDistribution,
  parseNormalizedScores,
} from "./scoring-utils";

describe("normalizeScore", () => {
  it("treats values > 1 as percentages and converts to decimal", () => {
    expect(normalizeScore(95)).toBe(0.95);
  });
  it("returns values already in [0,1] as-is (rounded to 4dp)", () => {
    expect(normalizeScore(0.5)).toBe(0.5);
  });
  it("returns 0 for zero", () => {
    expect(normalizeScore(0)).toBe(0);
  });
  it("returns 0 for negative values", () => {
    expect(normalizeScore(-1)).toBe(0);
  });
  it("returns 0 for non-finite values", () => {
    expect(normalizeScore(Number.NaN)).toBe(0);
    expect(normalizeScore(Number.POSITIVE_INFINITY)).toBe(0);
  });
});

describe("normalizeScoreDistribution", () => {
  it("normalizes positive scores so they sum to ~1", () => {
    const out = normalizeScoreDistribution([
      { name: "a", score: 10 },
      { name: "b", score: 20 },
    ]);
    const total = out.reduce((s, x) => s + x.score, 0);
    expect(total).toBeCloseTo(1, 3);
    expect(out[0]).toEqual({ name: "a", score: 0.3333 });
    expect(out[1]).toEqual({ name: "b", score: 0.6667 });
  });
  it("distributes evenly when all scores are zero", () => {
    const out = normalizeScoreDistribution([
      { name: "a", score: 0 },
      { name: "b", score: 0 },
    ]);
    expect(out).toEqual([
      { name: "a", score: 0.5 },
      { name: "b", score: 0.5 },
    ]);
  });
  it("returns an empty array unchanged", () => {
    expect(normalizeScoreDistribution([])).toEqual([]);
  });
});

describe("parseNormalizedScores", () => {
  it("returns an empty array for non-array input", () => {
    expect(parseNormalizedScores(null)).toEqual([]);
    expect(parseNormalizedScores("nope")).toEqual([]);
    expect(parseNormalizedScores(undefined)).toEqual([]);
  });
  it("filters out items with no name and sorts descending by score", () => {
    const out = parseNormalizedScores([
      { name: "", score: 99 },
      { name: "a", score: 50 },
      { name: "b", score: 100 },
    ]);
    expect(out).toHaveLength(2);
    expect(out[0].name).toBe("b");
    expect(out[1].name).toBe("a");
  });
  it("coerces numeric strings and drops invalid entries", () => {
    const out = parseNormalizedScores([
      null,
      { name: "ok", score: "75" },
    ]);
    expect(out).toEqual([{ name: "ok", score: 0.75 }]);
  });
});
