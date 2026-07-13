import { z } from "zod";
import type { ProviderId } from "../scorer";

export const aiAuditSchema = z.object({
  geo: z.object({
    score: z.number().min(0).max(100),
    finding: z.string(),
    fix: z.string(),
  }),
  aeo: z.object({
    score: z.number().min(0).max(100),
    finding: z.string(),
    fix: z.string(),
  }),
  structured: z.object({
    score: z.number().min(0).max(100),
    finding: z.string(),
    fix: z.string(),
  }),
  rankedFixes: z.array(
    z.object({
      title: z.string(),
      description: z.string(),
      impact: z.enum(["high", "medium", "low"]),
    }),
  ),
  technicalNarratives: z
    .record(
      z.string(),
      z.object({
        finding: z.string().optional(),
        fix: z.string().optional(),
        nudge: z.number().min(-5).max(5).optional(),
      }),
    )
    .optional(),
});

export type AIAuditResult = z.infer<typeof aiAuditSchema>;

export interface ProviderRunResult {
  provider: ProviderId;
  success: boolean;
  data?: AIAuditResult;
  error?: string;
}

export function buildAIPrompt(crawlSummary: object): string {
  return `You are an enterprise GEO and AEO auditor. Analyze the following website crawl summary and return ONLY valid JSON matching this schema:
{
  "geo": { "score": 0-100, "finding": "...", "fix": "..." },
  "aeo": { "score": 0-100, "finding": "...", "fix": "..." },
  "structured": { "score": 0-100, "finding": "...", "fix": "..." },
  "rankedFixes": [{ "title": "...", "description": "...", "impact": "high|medium|low" }],
  "technicalNarratives": { "jsonLd": { "finding": "...", "fix": "...", "nudge": -5 to 5 } }
}

Score GEO for generative engine citation readiness. Score AEO for answer engine extractability. Score Structured for content hierarchy exposed to machines. Traditional SEO is scored separately via Lighthouse and crawl rules — do not include an SEO score.

GROUNDING RULES (mandatory):
- Base findings ONLY on fields present in crawlSummary. Do not claim missing robots.txt, sitemap, title, H1, or JSON-LD if the summary shows they exist.
- If crawlIntegrity.pagesEligible === 0, return low-confidence scores (≤20) for all metrics and state that the crawl did not retrieve page content.
- If wordCount === 0 but htmlLength > 0 on a page, describe it as a "static HTML shell — content may be JS-rendered"; do not assert the site has no content as fact.
- When browserRendered is true, treat textSnippet as post-hydration content from a headless browser.
- Do not contradict robotsTxt.fetched, sitemap.present, extracted title, h1, or jsonLdTypes in the summary.
- When partialCrawl is true or crawlIntegrity.scopeLimitations is non-empty, lead findings with crawl scope caveats before other observations.
- When summaryMode is "map-reduce", base findings on pageBatches, topPagesByWordCount, and siteAggregates — not every URL individually.
- Use siteAggregates.coverageRatio and partialCrawl to calibrate confidence; do not score as if the full site was verified when coverageRatio is low.
- Do not detect or re-verify redirects, canonicals, hreflang, or schema — ruleScores and technicalIssueCounts already cover those.
- Do not attempt to work around crawl or TLS failures; reflect crawlIntegrity accurately.

SCORE CALIBRATION:
- When pagesEligible < pagesDiscovered, mention partial crawl and avoid extreme scores unless summary facts warrant them.
- When siteAggregates.coverageRatio < 0.85, cap scores at 75 unless pageBatches show strong content signals.
- Align interpretive scores with ruleScores where factual; use GEO, AEO, and Structured for AI visibility and content strategy.
- If crawlIntegrity.pagesEligible === 0, cap all scores at 20.

technicalNarratives (optional):
- Include ONLY for element ids where ruleScores[id].chip is "inferred" or "unverified".
- Provide nudge (-5 to +5) only — do not restate or replace rule-based findings for verified or estimated elements.
- Omit technicalNarratives entirely when all ruleScores chips are verified or estimated.

rankedFixes:
- Do not repeat crawlIntegrity.scopeLimitations or obvious rule gaps already covered by ruleScores (robots.txt, sitemap, JSON-LD basics).
- Focus rankedFixes on GEO/AEO strategy and content improvements beyond what extracted facts already show.

Crawl summary:
${JSON.stringify(crawlSummary, null, 2)}`;
}
