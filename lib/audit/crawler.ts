import { evaluateCanonicalPromotion } from "./canonical-scope";
import {
  expandDiscoveryFromInternalLinks,
  recomputeIncomingLinks,
  retryFailedPages,
} from "./crawl-expand";
import { auditConfig } from "./config";
import { extractInternalLinks } from "./extract";
import { fetchPageExtract, fetchPageExtractViaBrowser } from "./fetch-page";
import { fetchLlmsTxt } from "./llms";
import { rerenderShellPages, selectAnalysisPages } from "./page-render";
import { fetchRobotsTxt, isPathDisallowed } from "./robots";
import { normalizeUrl, discoverSitemapUrls, isHtmlUrl, type SitemapDiscoveryResult } from "./sitemap";
import {
  probeUrl,
  safeFetch,
} from "./security";
import type { UrlResolution } from "./url-resolve";
import type { CrawlResult, CrawlScopeMode, PageExtract, ProgressEmitter } from "./types";

export function isPageSuccessfullyFetched(p: PageExtract): boolean {
  return !p.fetchError && p.statusCode >= 200 && p.statusCode < 400;
}

export function getEligiblePages(pages: PageExtract[]): PageExtract[] {
  return pages.filter(isPageSuccessfullyFetched);
}

async function fetchWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
  signal?: AbortSignal,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let idx = 0;

  async function worker() {
    while (idx < items.length) {
      if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
      const i = idx++;
      results[i] = await fn(items[i], i);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}

function mergeDiscoveredUrls(...lists: string[][]): string[] {
  const merged = new Set<string>();
  for (const list of lists) {
    for (const url of list) merged.add(normalizeUrl(url));
  }
  return [...merged];
}

async function bfsDiscover(
  seedUrl: string,
  disallowedPaths: string[],
  emit: ProgressEmitter,
  signal?: AbortSignal,
): Promise<string[]> {
  const origin = new URL(seedUrl).origin;
  const queue = [normalizeUrl(seedUrl)];
  const visited = new Set<string>();
  const discovered: string[] = [];

  while (queue.length > 0) {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    const url = queue.shift()!;
    const norm = normalizeUrl(url);
    if (visited.has(norm) || !isHtmlUrl(norm)) continue;
    const path = new URL(norm).pathname;
    if (isPathDisallowed(path, disallowedPaths)) continue;

    visited.add(norm);
    discovered.push(norm);

    try {
      const res = await safeFetch(norm, { signal });
      if (!res.ok) continue;
      const html = await res.text();
      const links = extractInternalLinks(html, norm);
      for (const link of links) {
        try {
          if (new URL(link).origin === origin && !visited.has(normalizeUrl(link))) {
            queue.push(link);
          }
        } catch {
          // skip
        }
      }
    } catch {
      // skip page
    }

    if (discovered.length % 10 === 0 && discovered.length > 0) {
      emit({
        type: "log",
        icon: "🌐",
        text: `Discovered ${discovered.length} pages via internal links…`,
      });
    }
  }

  return discovered;
}

interface OriginDiscovery {
  robots: Awaited<ReturnType<typeof fetchRobotsTxt>>;
  llms: Awaited<ReturnType<typeof fetchLlmsTxt>>;
  sitemapDiscovery: SitemapDiscoveryResult;
  discoveredUrls: string[];
}

async function fetchSeedSignals(
  seedUrl: string,
  signal?: AbortSignal,
): Promise<{ canonicalUrl?: string; internalLinkCount: number } | undefined> {
  try {
    let page = await fetchPageExtract(seedUrl, signal);

    if (
      !isPageSuccessfullyFetched(page) ||
      (page.blocked && auditConfig.browserFallbackEnabled())
    ) {
      const rendered = await fetchPageExtractViaBrowser(seedUrl, signal);
      if (rendered && isPageSuccessfullyFetched(rendered)) {
        page = rendered;
      }
    }

    if (!isPageSuccessfullyFetched(page)) {
      return undefined;
    }

    return {
      canonicalUrl: page.canonicalUrl,
      internalLinkCount: page.internalLinks.length,
    };
  } catch {
    return undefined;
  }
}

async function discoverOnOrigin(
  origin: string,
  seedUrl: string,
  emit: ProgressEmitter,
  signal: AbortSignal | undefined,
  options: { supplementWithBfs: boolean },
): Promise<OriginDiscovery> {
  const normalized = normalizeUrl(seedUrl);

  const robots = await fetchRobotsTxt(origin, signal);
  emit({
    type: "log",
    icon: "🤖",
    text: robots.fetched
      ? "Auditing robots.txt indexes & allow-list directives for LLM bots…"
      : "robots.txt not retrieved — marking as unverified",
  });

  const llms = await fetchLlmsTxt(origin, signal);
  if (llms.present) {
    emit({ type: "log", icon: "📄", text: "llms.txt found — GEO/AEO signal boost" });
  }

  emit({ type: "log", icon: "📦", text: "Fetching sitemap.xml…" });
  const sitemapDiscovery = await discoverSitemapUrls(
    origin,
    normalized,
    auditConfig.maxSitemapDepth(),
    robots.disallowedPaths,
    signal,
  );

  if (sitemapDiscovery.skippedOffOrigin > 0) {
    emit({
      type: "log",
      icon: "⚠️",
      text: `Sitemap lists ${sitemapDiscovery.skippedOffOrigin} off-origin URL(s) — same-origin only (${sitemapDiscovery.offOriginDomains.join(", ") || "external domains"}).`,
    });
  }

  let discoveredUrls = sitemapDiscovery.urls;

  if (options.supplementWithBfs && discoveredUrls.length <= 1) {
    const message = sitemapDiscovery.present
      ? "Thin same-origin sitemap — supplementing with internal link discovery…"
      : "No sitemap — falling back to internal link discovery…";
    emit({ type: "log", icon: "🔗", text: message });
    const bfsUrls = await bfsDiscover(normalized, robots.disallowedPaths, emit, signal);
    discoveredUrls = mergeDiscoveredUrls(discoveredUrls, bfsUrls);
  }

  return { robots, llms, sitemapDiscovery, discoveredUrls };
}

export async function crawlSite(
  resolution: UrlResolution,
  emit: ProgressEmitter,
  signal?: AbortSignal,
): Promise<CrawlResult> {
  let normalized = normalizeUrl(resolution.effectiveUrl);
  let origin = resolution.effectiveOrigin;
  let domain = new URL(normalized).hostname;
  const concurrency = auditConfig.crawlConcurrency();

  let scopeMode: CrawlScopeMode =
    resolution.effectiveUrl !== resolution.requestedUrl ? "url-variant" : "requested-origin";
  let scopeNote: string | undefined;
  let canonicalPrimaryDomain: string | undefined;
  let promotedFromOrigin: string | undefined;

  emit({ type: "log", icon: "🔍", text: "Resolving DNS records & secure protocol handshake…" });
  emit({ type: "log", icon: "🌐", text: "Establishing remote secure connection…" });

  let { robots, llms, sitemapDiscovery, discoveredUrls } = await discoverOnOrigin(
    origin,
    normalized,
    emit,
    signal,
    { supplementWithBfs: false },
  );

  const seedSignals = await fetchSeedSignals(normalized, signal);
  const promotion = evaluateCanonicalPromotion({
    requestedOrigin: origin,
    seedCanonicalUrl: seedSignals?.canonicalUrl,
    sameOriginSitemapCount: sitemapDiscovery.urls.length,
    sitemapSkippedOffOrigin: sitemapDiscovery.skippedOffOrigin,
    offOriginDomains: sitemapDiscovery.offOriginDomains,
    seedInternalLinkCount: seedSignals?.internalLinkCount ?? 0,
  });

  if (promotion.promote && promotion.primarySeedUrl) {
    emit({
      type: "log",
      icon: "🔀",
      text: `Staging mirror detected — probing declared primary domain ${promotion.primaryDomain}…`,
    });
    const probe = await probeUrl(promotion.primarySeedUrl, signal);
    if (probe.ok) {
      promotedFromOrigin = origin;
      canonicalPrimaryDomain = promotion.primaryDomain;
      scopeMode = "canonical-primary";
      scopeNote = promotion.reason;
      normalized = normalizeUrl(probe.finalUrl);
      origin = new URL(normalized).origin;
      domain = new URL(normalized).hostname;

      emit({
        type: "log",
        icon: "🌐",
        text: `Crawling canonical primary domain ${origin} instead of staging origin.`,
      });

      ({ robots, llms, sitemapDiscovery, discoveredUrls } = await discoverOnOrigin(
        origin,
        normalized,
        emit,
        signal,
        { supplementWithBfs: true },
      ));
    } else {
      emit({
        type: "warning",
        message: `Could not reach declared primary domain (${promotion.primaryDomain}) — staying on requested origin.`,
      });
      if (discoveredUrls.length <= 1) {
        emit({
          type: "log",
          icon: "🔗",
          text: "Thin same-origin sitemap — supplementing with internal link discovery…",
        });
        const bfsUrls = await bfsDiscover(normalized, robots.disallowedPaths, emit, signal);
        discoveredUrls = mergeDiscoveredUrls(discoveredUrls, bfsUrls);
      }
    }
  } else if (discoveredUrls.length <= 1) {
    emit({
      type: "log",
      icon: "🔗",
      text: sitemapDiscovery.present
        ? "Thin same-origin sitemap — supplementing with internal link discovery…"
        : "No sitemap — falling back to internal link discovery…",
    });
    const bfsUrls = await bfsDiscover(normalized, robots.disallowedPaths, emit, signal);
    discoveredUrls = mergeDiscoveredUrls(discoveredUrls, bfsUrls);
  }

  emit({
    type: "log",
    icon: "🚀",
    text: `Fetching ${discoveredUrls.length} document source trees…`,
  });

  const rawPages = await fetchWithConcurrency(
    discoveredUrls,
    concurrency,
    async (url, i) => {
      emit({
        type: "log",
        icon: "📄",
        text: `Crawling page ${i + 1} of ${discoveredUrls.length}…`,
      });
      return fetchPageExtract(url, signal);
    },
    signal,
  );

  let pages = recomputeIncomingLinks(rawPages);

  const expanded = await expandDiscoveryFromInternalLinks(
    pages,
    discoveredUrls,
    origin,
    robots.disallowedPaths,
    emit,
    signal,
  );
  pages = recomputeIncomingLinks(expanded.pages);
  discoveredUrls = expanded.pageUrls;

  pages = await retryFailedPages(pages, normalized, emit, signal);
  pages = await rerenderShellPages(pages, normalized, emit, signal);

  const analyzedUrls = selectAnalysisPages(
    pages,
    auditConfig.aiSummaryPageLimit(),
    normalized,
  );

  emit({
    type: "log",
    icon: "📈",
    text: `Analyzing text-to-code ratios & alt tag coverage across ${pages.length} pages…`,
  });

  emit({
    type: "log",
    icon: "🔗",
    text: "Analyzing redirect chains, canonicals, hreflang & structured data…",
  });

  return {
    requestedUrl: resolution.requestedUrl,
    seedUrl: normalized,
    domain,
    scopeMode,
    scopeNote,
    canonicalPrimaryDomain,
    promotedFromOrigin,
    pages,
    pageUrls: discoveredUrls,
    analyzedUrls,
    robotsTxt: {
      fetched: robots.fetched,
      content: robots.content.slice(0, 1500),
      aiBotScore: robots.aiBotScore,
      allowsAiBots: robots.allowsAiBots,
    },
    llmsTxt: { present: llms.present, content: llms.content },
    sitemap: {
      present: sitemapDiscovery.present,
      urlCount: sitemapDiscovery.urls.length,
      skippedOffOrigin: sitemapDiscovery.skippedOffOrigin,
      offOriginDomains: sitemapDiscovery.offOriginDomains,
    },
  };
}

export { selectAnalysisPages, analysisPageScore, needsBrowserRender } from "./page-render";
