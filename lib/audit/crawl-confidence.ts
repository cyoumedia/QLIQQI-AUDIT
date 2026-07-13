import type { CrawlIntegrity } from "./types";

export type ConfidenceLevel = "high" | "medium" | "low";

export interface CrawlConfidence {
  /** pagesEligible / pagesDiscovered (0–1) */
  coverageRatio: number;
  level: ConfidenceLevel;
  /** When true, AI panel uses median across providers instead of max */
  useMedianScoring: boolean;
}

const MEDIUM_COVERAGE = 0.85;
const LOW_COVERAGE = 0.65;

export function computeCrawlConfidence(integrity: CrawlIntegrity): CrawlConfidence {
  const discovered = Math.max(integrity.pagesDiscovered, 1);
  const ratio = integrity.pagesEligible / discovered;

  if (ratio >= MEDIUM_COVERAGE) {
    return { coverageRatio: ratio, level: "high", useMedianScoring: false };
  }
  if (ratio >= LOW_COVERAGE) {
    return { coverageRatio: ratio, level: "medium", useMedianScoring: true };
  }
  return { coverageRatio: ratio, level: "low", useMedianScoring: true };
}

/**
 * Down-rank AI pillar scores when crawl coverage is incomplete.
 * Applied after provider merge (median or max).
 */
export function applyCrawlConfidencePenalty(score: number, confidence: CrawlConfidence): number {
  if (confidence.level === "high") return score;

  if (confidence.level === "medium") {
    return Math.round(score * (0.92 + confidence.coverageRatio * 0.08));
  }

  // low: scale by coverage and cap optimism
  return Math.round(Math.min(score, 75) * confidence.coverageRatio);
}

export function agreementFromSpread(spread: number): "high" | "medium" | "low" {
  if (spread <= 8) return "high";
  if (spread <= 15) return "medium";
  return "low";
}
