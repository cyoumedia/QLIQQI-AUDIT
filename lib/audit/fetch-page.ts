import { browserFetchHtml } from "./browser-fetch";
import { auditConfig } from "./config";
import { extractInternalLinks, extractPage } from "./extract";
import { classifyFetchError, safeFetchWithTrace } from "./security";
import type { PageExtract } from "./types";

export function failedPageExtract(
  url: string,
  error: ReturnType<typeof classifyFetchError>,
): PageExtract {
  const page = extractPage(url, "", { statusCode: 0, finalUrl: url, redirectChain: [] });
  page.fetchError = error.code;
  page.fetchErrorDetail = error.detail ?? error.message;
  page.blocked = false;
  return page;
}

/** Fetch a single page via HTTP trace (Cloudflare may escalate to browser internally). */
export async function fetchPageExtract(
  url: string,
  signal?: AbortSignal,
): Promise<PageExtract> {
  try {
    const trace = await safeFetchWithTrace(url, { signal });
    const html = trace.response.ok ? await trace.response.text() : "";
    const page = extractPage(url, html, {
      statusCode: trace.statusCode,
      finalUrl: trace.finalUrl,
      redirectChain: trace.redirectChain,
      canonicalHeader: trace.canonicalHeader,
    });
    if (!trace.response.ok || trace.statusCode < 200 || trace.statusCode >= 400) {
      page.fetchError = "HTTP_ERROR";
      page.fetchErrorDetail = `HTTP ${trace.statusCode}`;
      page.blocked = false;
    }
    page.internalLinks = extractInternalLinks(html, trace.finalUrl || url);
    return page;
  } catch (error) {
    return failedPageExtract(url, classifyFetchError(error, url));
  }
}

/** Browser-only fetch for retries when HTTP failed or returned a shell. */
export async function fetchPageExtractViaBrowser(
  url: string,
  signal?: AbortSignal,
): Promise<PageExtract | null> {
  if (!auditConfig.browserFallbackEnabled()) return null;

  const rendered = await browserFetchHtml(url, signal, { waitForContent: true });
  if (!rendered) return null;

  const page = extractPage(url, rendered.html, {
    statusCode: rendered.statusCode,
    finalUrl: rendered.finalUrl,
    redirectChain: [],
  });
  page.internalLinks = extractInternalLinks(rendered.html, rendered.finalUrl || url);
  page.browserRendered = true;
  page.fetchError = undefined;
  page.fetchErrorDetail = undefined;
  page.blocked = false;
  return page;
}
