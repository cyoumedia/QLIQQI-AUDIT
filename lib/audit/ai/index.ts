import type { CrawlResult } from "../types";
import { runClaudeAudit } from "./claude";
import { buildCrawlSummaryPayload, type CrawlSummaryContext } from "./summary-build";
import { runGrokAudit } from "./grok";
import { runOpenAIAudit } from "./openai";
import type { ProviderRunResult } from "./schema";

export type { CrawlSummaryContext } from "./summary-build";

export function buildCrawlSummary(crawl: CrawlResult, context: CrawlSummaryContext): object {
  return buildCrawlSummaryPayload(crawl, context);
}

export async function runAllProviders(
  crawl: CrawlResult,
  context: CrawlSummaryContext,
  signal?: AbortSignal,
): Promise<ProviderRunResult[]> {
  const summary = buildCrawlSummary(crawl, context);
  return Promise.all([
    runClaudeAudit(summary, signal),
    runGrokAudit(summary, signal),
    runOpenAIAudit(summary, signal),
  ]);
}

export type { ProviderRunResult, AIAuditResult } from "./schema";
