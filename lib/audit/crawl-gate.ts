import { getEligiblePages, isPageSuccessfullyFetched } from "./crawler";
import { extractPage } from "./extract";
import { isCloudflareChallengeDetail } from "./cloudflare";
import { normalizeUrl } from "./sitemap";
import type { CrawlResult, FetchErrorCode, PageExtract, PSIResult } from "./types";
import type { UrlResolution } from "./url-resolve";

export interface CrawlGateResult {
  abortExpensivePhases: boolean;
  reason?: string;
  psiFallbackUrls?: string[];
}

function isCloudflareOnlyFailure(resolution: UrlResolution): boolean {
  const failed = resolution.candidatesTried.filter((c) => c.error);
  return (
    failed.length > 0 &&
    failed.every((c) => isCloudflareChallengeDetail(c.errorDetail))
  );
}

function cloudflarePsiFallbackUrls(resolution: UrlResolution): string[] {
  return [normalizeUrl(resolution.requestedUrl)];
}

function findSeedPage(crawl: CrawlResult): PageExtract | undefined {
  const seedNorm = normalizeUrl(crawl.seedUrl);
  return crawl.pages.find(
    (p) => normalizeUrl(p.url) === seedNorm || normalizeUrl(p.finalUrl) === seedNorm,
  );
}

/** P2 gate — skip Lighthouse and AI when crawl integrity is insufficient. */
export function evaluateCrawlGate(
  resolution: UrlResolution,
  crawl: CrawlResult,
): CrawlGateResult {
  if (!resolution.resolved) {
    if (isCloudflareOnlyFailure(resolution)) {
      return {
        abortExpensivePhases: true,
        reason: resolution.note ?? "Direct crawl blocked by Cloudflare",
        psiFallbackUrls: cloudflarePsiFallbackUrls(resolution),
      };
    }
    return {
      abortExpensivePhases: true,
      reason: resolution.note ?? "URL resolution failed for all variants",
    };
  }

  const eligible = getEligiblePages(crawl.pages);
  if (eligible.length === 0) {
    return {
      abortExpensivePhases: true,
      reason: "No pages were successfully fetched during crawl",
    };
  }

  const seedPage = findSeedPage(crawl);
  if (!seedPage || !isPageSuccessfullyFetched(seedPage)) {
    return {
      abortExpensivePhases: true,
      reason: "Homepage / seed page could not be fetched",
    };
  }

  return { abortExpensivePhases: false };
}

/** Minimal crawl result when URL resolution fails — avoids full crawl on unreachable hosts. */
export function buildUnresolvedCrawl(resolution: UrlResolution): CrawlResult {
  const requestedUrl = resolution.requestedUrl;
  const normalized = normalizeUrl(requestedUrl);
  const domain = new URL(requestedUrl).hostname;
  const failedCandidate = [...resolution.candidatesTried].reverse().find((c) => c.error);
  const errorCode: FetchErrorCode = failedCandidate?.error ?? "NETWORK_ERROR";

  const page = extractPage(requestedUrl, "", {
    statusCode: 0,
    finalUrl: requestedUrl,
    redirectChain: [],
  });
  page.fetchError = errorCode;
  page.fetchErrorDetail = resolution.note ?? `All URL variants failed (${errorCode})`;
  page.blocked = false;

  return {
    requestedUrl,
    seedUrl: normalized,
    domain,
    scopeMode: "requested-origin",
    pages: [page],
    pageUrls: [normalized],
    analyzedUrls: [],
    robotsTxt: { fetched: false, content: "", aiBotScore: 0, allowsAiBots: false },
    llmsTxt: { present: false, content: "" },
    sitemap: { present: false, urlCount: 0, skippedOffOrigin: 0, offOriginDomains: [] },
  };
}

export function skippedPsiResult(reason: string): PSIResult {
  return {
    psiSeo: 0,
    status: "skipped",
    error: reason,
    scores: { performance: 0, accessibility: 0, bestPractices: 0 },
    opportunities: {},
    sampledUrls: [],
    successCount: 0,
    failureCount: 0,
  };
}

export function partialCrawlVerdictSuffix(integrity: {
  pagesEligible: number;
  pagesFailed: number;
  pagesDiscovered: number;
}): string | undefined {
  if (integrity.pagesEligible > 0 && integrity.pagesFailed > 0) {
    return `partial crawl (${integrity.pagesEligible}/${integrity.pagesDiscovered} pages)`;
  }
  return undefined;
}

export function crawlFailedVerdict(): string {
  return "Crawl failed — technical data unverified";
}
