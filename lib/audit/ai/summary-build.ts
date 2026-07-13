import { isPageSuccessfullyFetched } from "../crawler";
import { auditConfig } from "../config";
import type { CrawlIntegrity, CrawlResult, PageExtract, TechnicalCard, TechnicalIssuesSummary } from "../types";
import type { TechnicalElementId } from "../scorer";

export interface CrawlSummaryContext {
  crawlIntegrity: CrawlIntegrity;
  technical: TechnicalCard[];
  technicalIssues: TechnicalIssuesSummary;
}

export interface SiteAggregates {
  eligiblePages: number;
  failedPages: number;
  coverageRatio: number;
  avgWordCount: number;
  medianWordCount: number;
  thinPagePct: number;
  blockedPagePct: number;
  browserRenderedCount: number;
  jsonLdPagePct: number;
  pagesWithFaq: number;
}

export interface PageBatchSummary {
  batchIndex: number;
  pageCount: number;
  urls: string[];
  avgWordCount: number;
  titles: string[];
  headingSamples: string[];
  jsonLdTypes: string[];
  textExcerpt: string;
}

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
    : sorted[mid];
}

export function buildSiteAggregates(
  pages: PageExtract[],
  integrity: CrawlIntegrity,
): SiteAggregates {
  const eligible = pages.filter(isPageSuccessfullyFetched);
  const discovered = Math.max(integrity.pagesDiscovered, 1);
  const wordCounts = eligible.map((p) => p.wordCount);
  const thin = eligible.filter((p) => p.thin).length;
  const blocked = pages.filter((p) => p.blocked && !p.fetchError).length;
  const withJsonLd = eligible.filter((p) => p.jsonLdTypes.length > 0).length;
  const withFaq = eligible.filter((p) =>
    p.headings.some((h) => /faq|frågor/i.test(h)),
  ).length;

  return {
    eligiblePages: integrity.pagesEligible,
    failedPages: integrity.pagesFailed,
    coverageRatio: Math.round((integrity.pagesEligible / discovered) * 100) / 100,
    avgWordCount: wordCounts.length
      ? Math.round(wordCounts.reduce((a, b) => a + b, 0) / wordCounts.length)
      : 0,
    medianWordCount: median(wordCounts),
    thinPagePct: eligible.length ? Math.round((thin / eligible.length) * 100) : 0,
    blockedPagePct: pages.length ? Math.round((blocked / pages.length) * 100) : 0,
    browserRenderedCount: pages.filter((p) => p.browserRendered).length,
    jsonLdPagePct: eligible.length ? Math.round((withJsonLd / eligible.length) * 100) : 0,
    pagesWithFaq: withFaq,
  };
}

function buildPageBatchSummaries(
  pages: PageExtract[],
  batchSize: number,
): PageBatchSummary[] {
  const batches: PageBatchSummary[] = [];
  const maxChars = Math.min(auditConfig.aiMaxCharsPerPage(), 2000);

  for (let i = 0; i < pages.length; i += batchSize) {
    const slice = pages.slice(i, i + batchSize);
    const wordCounts = slice.map((p) => p.wordCount);
    const jsonLd = new Set<string>();
    const headings: string[] = [];
    const titles: string[] = [];
    const excerpts: string[] = [];

    for (const p of slice) {
      p.jsonLdTypes.forEach((t) => jsonLd.add(t));
      headings.push(...p.headings.slice(0, 4));
      if (p.title) titles.push(p.title);
      if (isPageSuccessfullyFetched(p)) {
        const snippet = p.html
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, maxChars);
        if (snippet) excerpts.push(snippet);
      }
    }

    batches.push({
      batchIndex: batches.length + 1,
      pageCount: slice.length,
      urls: slice.map((p) => p.url),
      avgWordCount: wordCounts.length
        ? Math.round(wordCounts.reduce((a, b) => a + b, 0) / wordCounts.length)
        : 0,
      titles: [...new Set(titles)].slice(0, 8),
      headingSamples: [...new Set(headings)].slice(0, 12),
      jsonLdTypes: [...jsonLd],
      textExcerpt: excerpts.join(" ").slice(0, maxChars * 2),
    });
  }

  return batches;
}

function buildPageDetail(p: PageExtract, maxChars: number): object {
  const pageSummary = {
    url: p.url,
    finalUrl: p.finalUrl,
    fetchError: p.fetchError,
    fetchErrorDetail: p.fetchErrorDetail,
    statusCode: p.statusCode,
    htmlLength: p.htmlLength,
    title: p.title,
    description: p.description,
    h1: p.h1,
    headingSamples: p.headings.slice(0, 8),
    wordCount: p.wordCount,
    jsonLdTypes: p.jsonLdTypes,
    hasFaq: p.headings.some((h) => /faq|frågor/i.test(h)),
    hasCanonical: p.hasCanonical,
    canonicalUrl: p.canonicalUrl,
    hreflangCount: p.hreflang.length,
    thin: p.thin,
    blocked: p.blocked,
    browserRendered: p.browserRendered === true,
    landmarks: p.landmarks,
  };

  if (!isPageSuccessfullyFetched(p)) {
    return pageSummary;
  }

  return {
    ...pageSummary,
    textSnippet: p.html
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, maxChars),
  };
}

export function buildCrawlSummaryPayload(
  crawl: CrawlResult,
  context: CrawlSummaryContext,
): object {
  const analyzed = crawl.pages.filter((p) => crawl.analyzedUrls.includes(p.url));
  const maxChars = auditConfig.aiMaxCharsPerPage();
  const { crawlIntegrity, technical, technicalIssues } = context;

  const ruleScores = Object.fromEntries(
    technical.map((t) => [t.id, { score: t.score, chip: t.chip }]),
  ) as Record<TechnicalElementId, { score: number; chip: TechnicalCard["chip"] }>;

  const partialCrawl =
    crawlIntegrity.pagesEligible > 0 && crawlIntegrity.pagesFailed > 0;

  const siteAggregates = buildSiteAggregates(crawl.pages, crawlIntegrity);
  const mapReduceThreshold = auditConfig.aiMapReduceThreshold();
  const useMapReduce = analyzed.length > mapReduceThreshold;

  const base = {
    domain: crawl.domain,
    seedUrl: crawl.seedUrl,
    pagesDiscovered: crawl.pageUrls.length,
    pagesAnalyzedInDepth: crawl.analyzedUrls.length,
    crawlIntegrity,
    ruleScores,
    technicalIssueCounts: technicalIssues.counts,
    partialCrawl,
    siteAggregates,
    robotsTxt: {
      fetched: crawl.robotsTxt.fetched,
      allowsAiBots: crawl.robotsTxt.allowsAiBots,
      aiBotScore: crawl.robotsTxt.aiBotScore,
    },
    llmsTxt: crawl.llmsTxt,
    sitemap: crawl.sitemap,
  };

  if (useMapReduce) {
    const batchSize = auditConfig.aiMapReduceBatchSize();
    const pageBatches = buildPageBatchSummaries(analyzed, batchSize);
    const topPages = analyzed
      .filter(isPageSuccessfullyFetched)
      .sort((a, b) => b.wordCount - a.wordCount)
      .slice(0, 5)
      .map((p) => buildPageDetail(p, maxChars));

    return {
      ...base,
      summaryMode: "map-reduce" as const,
      pageBatches,
      topPagesByWordCount: topPages,
    };
  }

  return {
    ...base,
    summaryMode: "full" as const,
    pages: analyzed.map((p) => buildPageDetail(p, maxChars)),
  };
}
