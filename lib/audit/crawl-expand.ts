import { auditConfig } from "./config";
import {
  fetchPageExtract,
  fetchPageExtractViaBrowser,
  failedPageExtract,
} from "./fetch-page";
import { isPathDisallowed } from "./robots";
import { isHtmlUrl, normalizeUrl } from "./sitemap";
import { classifyFetchError } from "./security";
import type { PageExtract, ProgressEmitter } from "./types";

function isPageSuccessfullyFetched(p: PageExtract): boolean {
  return !p.fetchError && p.statusCode >= 200 && p.statusCode < 400;
}

function sameOrigin(url: string, origin: string): boolean {
  try {
    return new URL(url).origin === origin;
  } catch {
    return false;
  }
}

/**
 * After the initial crawl pass, fetch same-origin URLs found in internal links
 * that were not in the original discovery set.
 */
export async function expandDiscoveryFromInternalLinks(
  pages: PageExtract[],
  discoveredUrls: string[],
  origin: string,
  disallowedPaths: string[],
  emit: ProgressEmitter,
  signal?: AbortSignal,
): Promise<{ pages: PageExtract[]; pageUrls: string[] }> {
  const known = new Set(discoveredUrls.map(normalizeUrl));
  const maxNew = auditConfig.crawlLinkExpansionMax();

  const candidates = new Set<string>();
  for (const page of pages) {
    if (!isPageSuccessfullyFetched(page)) continue;
    for (const link of page.internalLinks) {
      const norm = normalizeUrl(link);
      if (known.has(norm)) continue;
      if (!isHtmlUrl(norm) || !sameOrigin(norm, origin)) continue;
      const path = new URL(norm).pathname;
      if (isPathDisallowed(path, disallowedPaths)) continue;
      candidates.add(norm);
    }
  }

  const newUrls = [...candidates].slice(0, maxNew);
  if (newUrls.length === 0) {
    return { pages, pageUrls: discoveredUrls };
  }

  emit({
    type: "log",
    icon: "🔗",
    text: `Expanding crawl — ${newUrls.length} extra page(s) from internal links…`,
  });

  const fetched: PageExtract[] = [];
  for (const url of newUrls) {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    fetched.push(await fetchPageExtract(url, signal));
  }

  return {
    pages: [...pages, ...fetched],
    pageUrls: [...discoveredUrls, ...newUrls],
  };
}

function retryPriority(page: PageExtract, seedUrl: string): number {
  let score = page.incomingLinks;
  if (normalizeUrl(page.url) === normalizeUrl(seedUrl)) score += 10_000;
  return score;
}

/**
 * Retry failed page fetches once (HTTP, then browser fallback).
 */
export async function retryFailedPages(
  pages: PageExtract[],
  seedUrl: string,
  emit: ProgressEmitter,
  signal?: AbortSignal,
): Promise<PageExtract[]> {
  const maxRetries = auditConfig.crawlFetchRetryMax();
  const failed = pages
    .filter((p) => p.fetchError)
    .sort((a, b) => retryPriority(b, seedUrl) - retryPriority(a, seedUrl))
    .slice(0, maxRetries);

  if (failed.length === 0) return pages;

  emit({
    type: "log",
    icon: "🔁",
    text: `Retrying ${failed.length} failed page fetch(es)…`,
  });

  const byUrl = new Map(pages.map((p) => [normalizeUrl(p.url), p]));

  for (const page of failed) {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");

    let refreshed: PageExtract | null = null;
    try {
      refreshed = await fetchPageExtract(page.url, signal);
      if (!isPageSuccessfullyFetched(refreshed) && auditConfig.browserFallbackEnabled()) {
        refreshed = await fetchPageExtractViaBrowser(page.url, signal);
      }
    } catch (error) {
      refreshed = failedPageExtract(page.url, classifyFetchError(error, page.url));
    }

    if (refreshed && isPageSuccessfullyFetched(refreshed)) {
      refreshed.incomingLinks = page.incomingLinks;
      emit({
        type: "log",
        icon: "✓",
        text: `Retry succeeded for ${new URL(page.url).pathname || "/"}`,
      });
      byUrl.set(normalizeUrl(page.url), refreshed);
    }
  }

  return pages.map((p) => byUrl.get(normalizeUrl(p.url)) ?? p);
}

export function recomputeIncomingLinks(pages: PageExtract[]): PageExtract[] {
  const linkCounts = new Map<string, number>();
  for (const page of pages) {
    if (!isPageSuccessfullyFetched(page)) continue;
    for (const link of page.internalLinks) {
      const n = normalizeUrl(link);
      linkCounts.set(n, (linkCounts.get(n) ?? 0) + 1);
    }
  }
  return pages.map((p) => ({
    ...p,
    incomingLinks: linkCounts.get(normalizeUrl(p.url)) ?? 0,
  }));
}
