import type { CategoryScore, ScoringResponse } from "@/types/domain";
import { normalizeScoreDistribution } from "@/lib/scoring-utils";

export interface ScoringInput {
  fileName: string;
  contentPreview: string;
  categories: string[];
}

export interface ScoringStrategy {
  score(input: ScoringInput): Promise<ScoringResponse>;
}

function seededRandom(seed: string): number {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash << 5) - hash + seed.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash % 1000) / 1000;
}

export class MockScoringStrategy implements ScoringStrategy {
  async score(input: ScoringInput): Promise<ScoringResponse> {
    const delayMs = 200 + Math.floor(Math.random() * 600);
    await new Promise((resolve) => setTimeout(resolve, delayMs));

    const categories = input.categories.length ? input.categories : ["General", "Work", "Personal", "Finance"];
    const raw = categories.map((name) => {
      const base = seededRandom(`${input.fileName}:${name}:${input.contentPreview.slice(0, 32)}`);
      const variability = 0.5 + Math.random() * 0.5;
      return { name, score: base * variability + 0.05 };
    });

    const normalized = normalizeScoreDistribution(raw).sort((a, b) => b.score - a.score);
    return { categories: normalized };
  }
}

export class FutureOpenAIScoringStrategy implements ScoringStrategy {
  async score(input: ScoringInput): Promise<ScoringResponse> {
    return new MockScoringStrategy().score(input);
  }
}

export class ScoringStrategyFactory {
  static create(provider: "mock" | "future-openai"): ScoringStrategy {
    if (provider === "future-openai") {
      return new FutureOpenAIScoringStrategy();
    }
    return new MockScoringStrategy();
  }
}
