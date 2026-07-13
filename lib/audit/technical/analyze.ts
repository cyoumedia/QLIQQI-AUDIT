import { getEligiblePages, isPageSuccessfullyFetched } from "../crawler";
import { normalizeUrl } from "../sitemap";
import type { CrawlResult, PageExtract, TechnicalIssue, TechnicalIssuesSummary } from "../types";

const HREFLANG_RE = /^[a-z]{2}(-[a-z]{2})?$/i;

function norm(u: string): string {
  try {
    return normalizeUrl(u);
  } catch {
    return u;
  }
}

function pageByUrl(pages: PageExtract[]): Map<string, PageExtract> {
  const map = new Map<string, PageExtract>();
  for (const p of pages) {
    map.set(norm(p.url), p);
    if (p.finalUrl) map.set(norm(p.finalUrl), p);
  }
  return map;
}

function analyzeRedirects(pages: PageExtract[]): TechnicalIssue[] {
  const issues: TechnicalIssue[] = [];

  for (const p of pages) {
    if (p.fetchError || !isPageSuccessfullyFetched(p)) continue;
    const chain = p.redirectChain;
    if (chain.length === 0) continue;

    const hops = chain.filter((h) => h.status >= 300 && h.status < 400);
    if (hops.length >= 2) {
      issues.push({
        category: "redirect",
        severity: "warning",
        url: p.url,
        message: `Redirect chain has ${hops.length} hops — shorten to a single 301/308 where possible`,
      });
    } else if (hops.length === 1 && norm(p.url) !== norm(p.finalUrl)) {
      issues.push({
        category: "redirect",
        severity: "warning",
        url: p.url,
        message: `URL redirects to ${p.finalUrl}`,
      });
    }

    const urls = new Set(chain.map((h) => norm(h.url)));
    if (urls.size < chain.length) {
      issues.push({
        category: "redirect",
        severity: "error",
        url: p.url,
        message: "Redirect loop detected",
      });
    }

    if (p.statusCode >= 400) {
      issues.push({
        category: "redirect",
        severity: "error",
        url: p.url,
        message: `Final response is ${p.statusCode}`,
      });
    }

    try {
      const start = new URL(p.url);
      const end = new URL(p.finalUrl || p.url);
      if (start.protocol === "https:" && end.protocol === "http:") {
        issues.push({
          category: "redirect",
          severity: "error",
          url: p.url,
          message: "HTTPS URL redirects to HTTP",
        });
      }
    } catch {
      // skip
    }
  }

  return issues;
}

function analyzeCanonicals(pages: PageExtract[], origin: string): TechnicalIssue[] {
  const issues: TechnicalIssue[] = [];
  const canonicalTargets = new Map<string, string[]>();

  for (const p of pages) {
    if (p.fetchError || !isPageSuccessfullyFetched(p)) continue;
    if (p.statusCode >= 400 || p.blocked) continue;

    if (!p.canonicalUrl) {
      issues.push({
        category: "canonical",
        severity: "warning",
        url: p.url,
        message: "Missing canonical URL",
      });
      continue;
    }

    if (p.canonicalErrors?.includes("multiple")) {
      issues.push({
        category: "canonical",
        severity: "error",
        url: p.url,
        message: "Multiple canonical tags declared",
      });
    }

    let canonicalAbs: string;
    try {
      canonicalAbs = new URL(p.canonicalUrl, p.url).href;
    } catch {
      issues.push({
        category: "canonical",
        severity: "error",
        url: p.url,
        message: "Invalid canonical URL",
      });
      continue;
    }

    const canonNorm = norm(canonicalAbs);
    const pageNorm = norm(p.finalUrl || p.url);

    if (canonNorm !== pageNorm) {
      issues.push({
        category: "canonical",
        severity: "warning",
        url: p.url,
        message: `Canonical points to ${canonicalAbs} (differs from page URL)`,
      });
    }

    try {
      if (new URL(canonicalAbs).origin !== origin) {
        issues.push({
          category: "canonical",
          severity: "warning",
          url: p.url,
          message: `Canonical points off-site: ${canonicalAbs}`,
        });
      }
    } catch {
      // skip
    }

    const list = canonicalTargets.get(canonNorm) ?? [];
    list.push(p.url);
    canonicalTargets.set(canonNorm, list);
  }

  for (const [target, sources] of canonicalTargets) {
    if (sources.length > 1) {
      issues.push({
        category: "canonical",
        severity: "warning",
        url: sources[0],
        message: `${sources.length} pages share canonical ${target}`,
      });
    }
  }

  return issues;
}

function analyzeHreflang(pages: PageExtract[]): TechnicalIssue[] {
  const issues: TechnicalIssue[] = [];
  const byUrl = pageByUrl(pages);

  /** hreflang target (normalized) -> { fromUrl, lang }[] */
  const edges: { from: string; lang: string; to: string }[] = [];

  for (const p of pages) {
    if (p.fetchError || !isPageSuccessfullyFetched(p)) continue;
    for (const entry of p.hreflang) {
      if (entry.lang.toLowerCase() !== "x-default" && !HREFLANG_RE.test(entry.lang)) {
        issues.push({
          category: "hreflang",
          severity: "warning",
          url: p.url,
          message: `Invalid hreflang code "${entry.lang}"`,
        });
      }

      let target: string;
      try {
        target = norm(new URL(entry.url, p.url).href);
      } catch {
        issues.push({
          category: "hreflang",
          severity: "error",
          url: p.url,
          message: `Invalid hreflang URL for "${entry.lang}"`,
        });
        continue;
      }

      edges.push({ from: norm(p.url), lang: entry.lang.toLowerCase(), to: target });
    }
  }

  for (const { from, lang, to } of edges) {
    const targetPage = byUrl.get(to);
    if (!targetPage) {
      issues.push({
        category: "hreflang",
        severity: "warning",
        url: from,
        message: `Hreflang "${lang}" points to ${to} — not found in crawl`,
      });
      continue;
    }

    if (targetPage.statusCode >= 400) {
      issues.push({
        category: "hreflang",
        severity: "error",
        url: from,
        message: `Hreflang "${lang}" target returns ${targetPage.statusCode}`,
      });
    }

    const returnLink = targetPage.hreflang.find(
      (h) => norm(new URL(h.url, targetPage.url).href) === from,
    );
    if (!returnLink) {
      issues.push({
        category: "hreflang",
        severity: "error",
        url: from,
        message: `Missing return hreflang link from ${to} back to ${from}`,
      });
    } else if (returnLink.lang.toLowerCase() !== lang && lang !== "x-default") {
      issues.push({
        category: "hreflang",
        severity: "warning",
        url: from,
        message: `Inconsistent hreflang return: expected "${lang}", got "${returnLink.lang}"`,
      });
    }
  }

  const pagesWithHreflang = pages.filter((p) => p.hreflang.length > 0);
  if (pagesWithHreflang.length > 0) {
    const hasXDefault = pagesWithHreflang.some((p) =>
      p.hreflang.some((h) => h.lang.toLowerCase() === "x-default"),
    );
    if (!hasXDefault) {
      issues.push({
        category: "hreflang",
        severity: "warning",
        url: pagesWithHreflang[0].url,
        message: "Hreflang cluster missing x-default alternate",
      });
    }
  }

  return issues;
}

function analyzeStructuredData(pages: PageExtract[]): TechnicalIssue[] {
  const issues: TechnicalIssue[] = [];

  for (const p of pages) {
    if (p.fetchError || !isPageSuccessfullyFetched(p)) continue;
    if (p.statusCode >= 400 || p.blocked) continue;

    if (p.structuredData.length === 0) continue;

    for (const block of p.structuredData) {
      for (const err of block.errors) {
        issues.push({
          category: "structured-data",
          severity: block.valid ? "warning" : "error",
          url: p.url,
          message:
            block.types.length > 0
              ? `${block.format} (${block.types.join(", ")}): ${err}`
              : `${block.format}: ${err}`,
        });
      }
    }
  }

  return issues;
}

function dedupeIssues(issues: TechnicalIssue[]): TechnicalIssue[] {
  const seen = new Set<string>();
  const out: TechnicalIssue[] = [];
  for (const issue of issues) {
    const key = `${issue.category}|${issue.url}|${issue.message}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(issue);
  }
  return out;
}

export function analyzeTechnicalIssues(crawl: CrawlResult): TechnicalIssuesSummary {
  const pages = getEligiblePages(crawl.pages);
  const origin = new URL(crawl.seedUrl).origin;

  const redirectChains = dedupeIssues(analyzeRedirects(pages));
  const canonicalErrors = dedupeIssues(analyzeCanonicals(pages, origin));
  const hreflangErrors = dedupeIssues(analyzeHreflang(pages));
  const schemaErrors = dedupeIssues(analyzeStructuredData(pages));

  return {
    redirectChains,
    canonicalErrors,
    hreflangErrors,
    schemaErrors,
    counts: {
      redirect: redirectChains.length,
      canonical: canonicalErrors.length,
      hreflang: hreflangErrors.length,
      "structured-data": schemaErrors.length,
      total:
        redirectChains.length +
        canonicalErrors.length +
        hreflangErrors.length +
        schemaErrors.length,
    },
  };
}
