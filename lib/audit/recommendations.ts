import type { AIAuditResult } from "./ai/schema";
import type { CrawlIntegrity, TechnicalCard } from "./types";
import type { ProviderId } from "./scorer";

export interface RankedRecommendation {
  rank: number;
  title: string;
  description: string;
  impact: "high" | "medium" | "low";
  source: "ai" | "rules";
}

interface RankedItem {
  title: string;
  description: string;
  impact: "high" | "medium" | "low";
  source: "ai" | "rules";
}

const RULE_FIXES: Record<string, { title: string; description: string }> = {
  jsonLd: {
    title: "Add JSON-LD structured data",
    description:
      "LocalBusiness + FAQPage + Service + BreadcrumbList. The decisive move for both GEO and AEO.",
  },
  robotsTxt: {
    title: "Publish robots.txt with AI crawler allow-list",
    description: "Explicitly allow GPTBot, ClaudeBot, PerplexityBot, Google-Extended and CCBot.",
  },
  xmlSitemap: {
    title: "Publish XML sitemap",
    description: "Generate sitemap.xml, reference in robots.txt, submit in Search Console.",
  },
  metaTags: {
    title: "Complete meta tag coverage",
    description: "Ensure unique title, description, OG, and canonical on every page.",
  },
  altText: {
    title: "Improve image alt text",
    description: "Add descriptive alt text; use alt=\"\" for decorative images.",
  },
};

function impactFromScore(score: number): "high" | "medium" | "low" {
  if (score < 40) return "high";
  if (score < 70) return "medium";
  return "low";
}

function dedupeTitle(a: string, b: string): boolean {
  const na = a.toLowerCase().slice(0, 20);
  const nb = b.toLowerCase().slice(0, 20);
  return na === nb || na.includes(nb) || nb.includes(na);
}

function buildCrawlScopeRecommendations(integrity: CrawlIntegrity): RankedItem[] {
  const items: RankedItem[] = [];

  if (
    integrity.sitemapSkippedOffOriginCount > 0 &&
    integrity.scopeMode !== "canonical-primary"
  ) {
    const domains =
      integrity.sitemapSkippedOffOriginCount === 1
        ? "an external domain"
        : "external domains";
    items.push({
      title: "Review sitemap same-origin coverage",
      description: `Sitemap included ${integrity.sitemapSkippedOffOriginCount} off-origin URL(s) on ${domains} — excluded from this audit. Point sitemap entries at same-origin pages or audit each domain separately.`,
      impact: "medium",
      source: "rules",
    });
  }

  if (integrity.scopeMode === "canonical-primary" && integrity.canonicalPrimaryDomain) {
    items.push({
      title: "Staging URL audited via canonical primary domain",
      description: `This audit crawled ${integrity.canonicalPrimaryDomain} because the requested staging URL declared it as canonical. Re-run against production directly if you want scores attributed to that URL in the report header.`,
      impact: "low",
      source: "rules",
    });
  }

  if (integrity.pagesEligible === 0) {
    items.push({
      title: "Fix site accessibility before auditing",
      description:
        "No pages could be fetched. Resolve TLS, DNS, or HTTP errors on the requested URL, then re-run the audit.",
      impact: "high",
      source: "rules",
    });
  }

  if (integrity.pagesFailed > 0 && integrity.pagesEligible > 0) {
    items.push({
      title: "Investigate page fetch failures",
      description: `${integrity.pagesFailed} of ${integrity.pagesDiscovered} discovered pages could not be fetched. Resolve TLS, DNS, or HTTP errors before relying on technical scores.`,
      impact: "high",
      source: "rules",
    });
  }

  if (
    integrity.pagesEligible > 0 &&
    integrity.pagesDiscovered > 1 &&
    integrity.pagesEligible < integrity.pagesDiscovered * 0.5
  ) {
    items.push({
      title: "Low crawl coverage",
      description: `Only ${integrity.pagesEligible} of ${integrity.pagesDiscovered} discovered pages were successfully fetched — scores reflect partial site coverage.`,
      impact: "high",
      source: "rules",
    });
  }

  if (
    integrity.sitemapPresent &&
    integrity.sitemapSameOriginCount <= 1 &&
    integrity.sitemapSkippedOffOriginCount > 0 &&
    integrity.scopeMode !== "canonical-primary"
  ) {
    items.push({
      title: "Sitemap scope limits crawl depth",
      description:
        "After filtering to same-origin URLs, only one page remains in sitemap scope. Technical scores may not represent the full site.",
      impact: "medium",
      source: "rules",
    });
  }

  return items;
}

export function buildRankedRecommendations(
  technical: TechnicalCard[],
  providerResults: { provider: ProviderId; data?: AIAuditResult }[],
  winningProvider: ProviderId | null,
  crawlIntegrity?: CrawlIntegrity,
): RankedRecommendation[] {
  const items: RankedItem[] = [];

  if (crawlIntegrity) {
    for (const rec of buildCrawlScopeRecommendations(crawlIntegrity)) {
      if (!items.some((i) => dedupeTitle(i.title, rec.title))) {
        items.push(rec);
      }
    }
  }

  const winner = providerResults.find((r) => r.provider === winningProvider);
  const allFixes = providerResults.flatMap((r) => r.data?.rankedFixes ?? []);

  for (const fix of winner?.data?.rankedFixes ?? allFixes) {
    if (!items.some((i) => dedupeTitle(i.title, fix.title))) {
      items.push({ ...fix, source: "ai" });
    }
  }

  for (const card of technical) {
    if (card.score < 50 && RULE_FIXES[card.id]) {
      const template = RULE_FIXES[card.id];
      if (!items.some((i) => dedupeTitle(i.title, template.title))) {
        items.push({
          ...template,
          impact: impactFromScore(card.score),
          source: "rules",
        });
      }
    }
  }

  const order = { high: 0, medium: 1, low: 2 };
  return items
    .sort((a, b) => order[a.impact] - order[b.impact])
    .slice(0, 8)
    .map((item, i) => ({ ...item, rank: i + 1 }));
}
