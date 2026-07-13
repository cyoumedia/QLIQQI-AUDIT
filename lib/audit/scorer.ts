/**
 * QLIQQI audit scoring — single source of truth for all composite metrics.
 * Adjust weights and formulas here as product requirements evolve.
 *
 * @see Overall Score Calc.md — hero gauge uses 12 elements (SEO excluded from overall).
 */

import type { CrawlConfidence } from "./crawl-confidence";
import { applyCrawlConfidencePenalty, agreementFromSpread } from "./crawl-confidence";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ProviderId = "claude" | "grok" | "openai";

export type VerificationChip =
  | "verified"
  | "inferred"
  | "estimated"
  | "unverified";

export type TechnicalElementId =
  | "jsonLd"
  | "metaTags"
  | "semanticHtml"
  | "altText"
  | "internalLinking"
  | "textToCode"
  | "mobileViewport"
  | "robotsTxt"
  | "xmlSitemap"
  | "llmsTxt";

export type PanelMetricId = "seo" | "geo" | "aeo" | "structured";

export type AiPanelMetricId = Exclude<PanelMetricId, "seo">;

export type AgreementLevel = "high" | "medium" | "low";

export interface ProviderMetricScores {
  geo: number;
  aeo: number;
  structured: number;
}

export interface AiMetricScoreMeta {
  score: number;
  winner: ProviderId | null;
  spread: number;
  range: { min: number; max: number };
  agreement: AgreementLevel;
  method: "max" | "median";
  rawByProvider: Partial<Record<ProviderId, number>>;
}

export interface TechnicalElementScore {
  id: TechnicalElementId;
  score: number;
  chip: VerificationChip;
  /** Optional AI nudge applied (±5) for inferred/unverified only */
  aiNudge?: number;
}

export interface PanelScoreInput {
  /** Per-provider GEO / AEO / Structured scores */
  providerScores: Partial<Record<ProviderId, ProviderMetricScores>>;
  /** PSI SEO score for the seed URL (headline SEO panel score when PSI available) */
  psiSeo: number;
  /** Rules-derived SEO proxy when PSI is unavailable */
  rulesSeoProxy: number;
  /** When true, SEO panel uses rulesSeoProxy instead of psiSeo */
  psiUnavailable: boolean;
  crawlConfidence: CrawlConfidence;
}

export interface ScoredPanel {
  seo: number;
  geo: number;
  aeo: number;
  structured: number;
  meta: {
    psiSeo: number;
    rulesSeoProxy: number;
    seoSource: "psi" | "rules";
    winningProvider: Record<AiPanelMetricId, ProviderId | null>;
    aiMetrics: Record<AiPanelMetricId, AiMetricScoreMeta>;
    crawlConfidence: CrawlConfidence;
  };
}

export interface ScoredAudit {
  technical: TechnicalElementScore[];
  panel: ScoredPanel;
  /** Hero gauge — 10 technical + GEO + AEO + Structured (13 elements). SEO excluded. */
  overall: number;
  verdict: string;
}

// ---------------------------------------------------------------------------
// Config — tune here
// ---------------------------------------------------------------------------

/** Technical elements averaged when PSI SEO is unavailable */
export const SEO_PROXY_ELEMENTS: TechnicalElementId[] = [
  "metaTags",
  "mobileViewport",
  "altText",
  "internalLinking",
  "semanticHtml",
];

/** Human-readable labels for {@link SEO_PROXY_ELEMENTS} (UI / tooltips) */
export const SEO_PROXY_ELEMENT_LABELS = [
  "Meta tags",
  "Mobile viewport",
  "Alt text",
  "Internal linking",
  "Semantic HTML",
] as const;

/** Optional AI adjustment bounds for inferred/unverified technical elements */
export const AI_NUDGE_MIN = -5;
export const AI_NUDGE_MAX = 5;

/** Verdict bands for hero gauge */
export const VERDICT_BANDS = [
  { min: 85, label: "Excellent AI-first site" },
  { min: 75, label: "Very good" },
  { min: 65, label: "Solid foundation but needs work" },
  { min: 0, label: "Major technical issues" },
] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function clamp(score: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, score));
}

export function roundScore(score: number): number {
  return Math.round(score);
}

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

/** Closest provider to the merged score (for narrative selection). */
function closestProvider(
  rawByProvider: Partial<Record<ProviderId, number>>,
  target: number,
): ProviderId | null {
  const entries = Object.entries(rawByProvider) as [ProviderId, number][];
  if (entries.length === 0) return null;
  return entries.reduce((best, cur) =>
    Math.abs(cur[1] - target) < Math.abs(best[1] - target) ? cur : best,
  )[0];
}

/**
 * Merge GEO / AEO / Structured scores across providers.
 * Uses median when crawl coverage is partial OR providers disagree; max only when both are high-confidence.
 */
export function mergeProviderMetric(
  providerScores: Partial<Record<ProviderId, ProviderMetricScores>>,
  metric: AiPanelMetricId,
  crawlConfidence: CrawlConfidence,
): AiMetricScoreMeta {
  const entries = (
    Object.entries(providerScores) as [ProviderId, ProviderMetricScores][]
  )
    .filter(([, scores]) => typeof scores?.[metric] === "number")
    .map(([id, scores]) => ({ id, score: clamp(scores[metric]) }));

  const rawByProvider = Object.fromEntries(entries.map((e) => [e.id, e.score])) as Partial<
    Record<ProviderId, number>
  >;

  if (entries.length === 0) {
    return {
      score: 0,
      winner: null,
      spread: 0,
      range: { min: 0, max: 0 },
      agreement: "high",
      method: "median",
      rawByProvider: {},
    };
  }

  const values = entries.map((e) => e.score);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const spread = max - min;
  const agreement = agreementFromSpread(spread);
  const method =
    crawlConfidence.useMedianScoring || agreement !== "high" ? "median" : "max";
  const merged = method === "median" ? median(values) : max;
  const penalized = applyCrawlConfidencePenalty(merged, crawlConfidence);
  const score = clamp(roundScore(penalized));
  const winner =
    method === "max"
      ? entries.reduce((a, b) => (b.score > a.score ? b : a)).id
      : closestProvider(rawByProvider, score);

  return {
    score,
    winner,
    spread,
    range: { min, max },
    agreement: agreementFromSpread(spread),
    method,
    rawByProvider,
  };
}

/** @deprecated Use mergeProviderMetric — kept for tests/dev comparisons */
export function maxProviderMetric(
  providerScores: Partial<Record<ProviderId, ProviderMetricScores>>,
  metric: AiPanelMetricId,
): { score: number; winner: ProviderId | null } {
  const entries = (
    Object.entries(providerScores) as [ProviderId, ProviderMetricScores][]
  )
    .filter(([, scores]) => typeof scores?.[metric] === "number")
    .map(([id, scores]) => ({ id, score: scores[metric] }));

  if (entries.length === 0) return { score: 0, winner: null };
  const best = entries.reduce((a, b) => (b.score > a.score ? b : a));
  return { score: clamp(best.score), winner: best.id };
}

export function average(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

export function verdictForScore(overall: number): string {
  const band = VERDICT_BANDS.find((b) => overall >= b.min);
  return band?.label ?? VERDICT_BANDS[VERDICT_BANDS.length - 1].label;
}

/**
 * Rules-derived SEO score when Lighthouse PSI is skipped or failed.
 * Averages on-page SEO signals already computed in technical cards.
 */
export function computeRulesSeoProxy(technical: TechnicalElementScore[]): number {
  const scores = technical
    .filter((t) => SEO_PROXY_ELEMENTS.includes(t.id))
    .map((t) => t.score);
  if (scores.length === 0) return 0;
  return roundScore(average(scores));
}

/**
 * Apply optional AI nudge for inferred/unverified technical elements only.
 * Verified/estimated rule scores are never overridden beyond nudge bounds.
 */
export function applyTechnicalNudge(
  ruleScore: number,
  chip: VerificationChip,
  aiNudge = 0,
): number {
  if (chip === "verified" || chip === "estimated") {
    return clamp(roundScore(ruleScore));
  }
  const nudge = clamp(aiNudge, AI_NUDGE_MIN, AI_NUDGE_MAX);
  return clamp(roundScore(ruleScore + nudge));
}

// ---------------------------------------------------------------------------
// Composites
// ---------------------------------------------------------------------------

/**
 * Hero overall gauge: simple average of 13 elements.
 * 10 technical + GEO + AEO + Structured Content.
 * SEO panel score is intentionally excluded — see Overall Score Calc.md.
 */
export function computeOverallScore(
  technical: TechnicalElementScore[],
  panel: Pick<ScoredPanel, "geo" | "aeo" | "structured">,
): number {
  const technicalScores = technical.map((t) => t.score);
  const heroElements = [
    ...technicalScores,
    panel.geo,
    panel.aeo,
    panel.structured,
  ];
  return roundScore(average(heroElements));
}

/** Score full panel from provider outputs + PSI SEO (or rules proxy) */
export function scorePanel(input: PanelScoreInput): ScoredPanel {
  const aiMetrics: AiPanelMetricId[] = ["geo", "aeo", "structured"];
  const winningProvider = {} as Record<AiPanelMetricId, ProviderId | null>;
  const metricMeta = {} as Record<AiPanelMetricId, AiMetricScoreMeta>;
  const raw: Record<AiPanelMetricId, number> = {
    geo: 0,
    aeo: 0,
    structured: 0,
  };

  for (const metric of aiMetrics) {
    const merged = mergeProviderMetric(
      input.providerScores,
      metric,
      input.crawlConfidence,
    );
    metricMeta[metric] = merged;
    raw[metric] = merged.score;
    winningProvider[metric] = merged.winner;
  }

  const seoSource = input.psiUnavailable ? "rules" : "psi";
  const seo = clamp(
    roundScore(input.psiUnavailable ? input.rulesSeoProxy : input.psiSeo),
  );

  return {
    seo,
    geo: raw.geo,
    aeo: raw.aeo,
    structured: raw.structured,
    meta: {
      psiSeo: input.psiSeo,
      rulesSeoProxy: input.rulesSeoProxy,
      seoSource,
      winningProvider,
      aiMetrics: metricMeta,
      crawlConfidence: input.crawlConfidence,
    },
  };
}

/** Full audit scoring pass */
export function scoreAudit(
  technical: TechnicalElementScore[],
  panelInput: PanelScoreInput,
): ScoredAudit {
  const panel = scorePanel(panelInput);
  const overall = computeOverallScore(technical, panel);

  return {
    technical,
    panel,
    overall,
    verdict: verdictForScore(overall),
  };
}
