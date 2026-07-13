import { auditConfig } from "./config";
import { browserFetchHtml } from "./browser-fetch";
import { extractInternalLinks, extractPage } from "./extract";
import { normalizeUrl } from "./sitemap";
import type { PageExtract, ProgressEmitter } from "./types";

/** Path segments that usually carry GEO/AEO-relevant content. */
const CONTENT_PATH =
  /\/(about|services|service|faq|faqs|pricing|contact|team|blog|resources|solutions|products|how-it-works|features)(\/|$)/i;

function isPageSuccessfullyFetched(p: PageExtract): boolean {
  return !p.fetchError && p.statusCode >= 200 && p.statusCode < 400;
}

/**
 * True when static HTML looks like an empty JS shell worth re-fetching in a browser.
 */
export function needsBrowserRender(page: PageExtract): boolean {
  if (!auditConfig.browserFallbackEnabled()) return false;
  if (!isPageSuccessfullyFetched(page)) return false;

  const minHtml = auditConfig.browserShellMinHtml();
  const minWords = auditConfig.browserShellMinWords();

  if (page.blocked) return true;
  if (page.htmlLength >= minHtml && page.wordCount < minWords) return true;
  return false;
}

function shellRenderPriority(page: PageExtract, seedUrl: string): number {
  let score = page.incomingLinks;
  if (normalizeUrl(page.url) === normalizeUrl(seedUrl)) score += 10_000;
  return score;
}

/**
 * Re-fetch JS shell pages via Playwright and merge refreshed extracts into the crawl.
 */
export async function rerenderShellPages(
  pages: PageExtract[],
  seedUrl: string,
  emit: ProgressEmitter,
  signal?: AbortSignal,
): Promise<PageExtract[]> {
  if (!auditConfig.browserFallbackEnabled()) return pages;

  const maxPages = auditConfig.browserShellMaxPages();
  const candidates = pages
    .filter(needsBrowserRender)
    .sort((a, b) => shellRenderPriority(b, seedUrl) - shellRenderPriority(a, seedUrl))
    .slice(0, maxPages);

  if (candidates.length === 0) return pages;

  emit({
    type: "log",
    icon: "🖥️",
    text: `Rendering ${candidates.length} JS shell page(s) via headless browser…`,
  });

  const byUrl = new Map(pages.map((p) => [normalizeUrl(p.url), p]));

  for (const page of candidates) {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");

    const rendered = await browserFetchHtml(page.url, signal, { waitForContent: true });
    if (!rendered) {
      emit({
        type: "log",
        icon: "⚠️",
        text: `Browser render failed for ${new URL(page.url).pathname || "/"}`,
      });
      continue;
    }

    const refreshed = extractPage(page.url, rendered.html, {
      statusCode: rendered.statusCode,
      finalUrl: rendered.finalUrl,
      redirectChain: page.redirectChain,
    });
    refreshed.internalLinks = extractInternalLinks(
      rendered.html,
      rendered.finalUrl || page.url,
    );
    refreshed.incomingLinks = page.incomingLinks;
    refreshed.browserRendered = true;

    if (needsBrowserRender(refreshed)) {
      emit({
        type: "log",
        icon: "⚠️",
        text: `Browser render still thin for ${new URL(page.url).pathname || "/"} (${refreshed.wordCount} words)`,
      });
    } else {
      emit({
        type: "log",
        icon: "✓",
        text: `Rendered ${new URL(page.url).pathname || "/"} (${refreshed.wordCount} words)`,
      });
    }

    byUrl.set(normalizeUrl(page.url), refreshed);
  }

  return pages.map((p) => byUrl.get(normalizeUrl(p.url)) ?? p);
}

/** Rank pages for in-depth AI analysis (content-rich + high-value templates). */
export function analysisPageScore(page: PageExtract, seedUrl: string): number {
  let score = 0;
  score += page.incomingLinks * 2;
  score += Math.min(page.wordCount / 10, 50);
  if (page.jsonLdTypes.length > 0) score += 15;
  if (page.headings.some((h) => /faq|frågor/i.test(h))) score += 20;
  if (page.browserRendered) score += 5;

  try {
    const path = new URL(page.url).pathname;
    if (CONTENT_PATH.test(path)) score += 25;
  } catch {
    // skip invalid URL
  }

  if (normalizeUrl(page.url) === normalizeUrl(seedUrl)) score += 30;
  return score;
}

export function selectAnalysisPages(
  pages: PageExtract[],
  limit: number,
  seedUrl: string,
): string[] {
  const eligible = pages.filter(isPageSuccessfullyFetched);
  const picked = new Set<string>();

  const sorted = [...eligible].sort(
    (a, b) => analysisPageScore(b, seedUrl) - analysisPageScore(a, seedUrl),
  );

  for (const p of sorted) {
    if (picked.size >= limit) break;
    picked.add(p.url);
  }

  return [...picked].slice(0, limit);
}
