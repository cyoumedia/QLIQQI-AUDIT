export function envInt(key: string, fallback: number): number {
  const v = process.env[key];
  if (!v) return fallback;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

export function envBool(key: string, fallback: boolean): boolean {
  const v = process.env[key];
  if (!v) return fallback;
  return v === "true" || v === "1";
}

/**
 * Dev-only report extras and UI (crawl JSON download, per-provider scores).
 * Defaults to on when NODE_ENV is development; set NEXT_PUBLIC_QLIQQI_DEV_FEATURES=false
 * in .env.local to preview the production client while running npm run dev.
 */
export function devFeaturesEnabled(): boolean {
  const flag =
    process.env.NEXT_PUBLIC_QLIQQI_DEV_FEATURES ?? process.env.QLIQQI_DEV_FEATURES;
  if (flag === "false" || flag === "0") return false;
  if (flag === "true" || flag === "1") return true;
  return process.env.NODE_ENV === "development";
}

/** @deprecated Prefer devFeaturesEnabled */
export function isDevMode(): boolean {
  return devFeaturesEnabled();
}

export const auditConfig = {
  crawlConcurrency: () => envInt("CRAWL_CONCURRENCY", 8),
  psiSampleSize: () => envInt("PSI_SAMPLE_SIZE", 8),
  psiConcurrency: () => envInt("PSI_CONCURRENCY", 2),
  /** Max failing Lighthouse audits per category on the seed URL diagnostic list. */
  psiDiagnosticsMaxPerCategory: () => envInt("PSI_DIAGNOSTICS_MAX", 20),
  aiSummaryPageLimit: () => envInt("AI_SUMMARY_PAGE_LIMIT", 50),
  aiMaxCharsPerPage: () => envInt("AI_MAX_CHARS_PER_PAGE", 4000),
  maxSitemapDepth: () => envInt("MAX_SITEMAP_DEPTH", 3),
  crawlBudgetEnabled: () => envBool("CRAWL_BUDGET_ENABLED", false),
  crawlBudgetMs: () => envInt("CRAWL_BUDGET_MS", 480000),
  rateLimitAuditsPerHour: () => envInt("RATE_LIMIT_AUDITS_PER_HOUR", 3),
  browserFallbackEnabled: () => envBool("CRAWL_BROWSER_FALLBACK", true),
  /** When true, shows a visible Chrome window during Cloudflare bypass (debug only). */
  browserHeaded: () => envBool("CRAWL_BROWSER_HEADED", false),
  /** Max pages re-fetched via browser when static HTML looks like a JS shell. */
  browserShellMaxPages: () => envInt("CRAWL_BROWSER_SHELL_MAX_PAGES", 10),
  /** Min HTML length before treating low word count as a JS shell candidate. */
  browserShellMinHtml: () => envInt("CRAWL_BROWSER_SHELL_MIN_HTML", 500),
  /** Word-count threshold — below this with sufficient HTML triggers browser render. */
  browserShellMinWords: () => envInt("CRAWL_BROWSER_SHELL_MIN_WORDS", 30),
  /** Max failed page fetches to retry once per audit. */
  crawlFetchRetryMax: () => envInt("CRAWL_FETCH_RETRY_MAX", 8),
  /** Max extra URLs to fetch from per-page internal links after initial discovery. */
  crawlLinkExpansionMax: () => envInt("CRAWL_LINK_EXPANSION_MAX", 40),
  /** When analyzed pages exceed this count, use map-reduce summary compression for AI. */
  aiMapReduceThreshold: () => envInt("AI_MAP_REDUCE_THRESHOLD", 15),
  /** Pages per batch in map-reduce crawl summaries. */
  aiMapReduceBatchSize: () => envInt("AI_MAP_REDUCE_BATCH_SIZE", 8),
};
