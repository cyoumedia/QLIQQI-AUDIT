import { getEligiblePages } from "./crawler";
import type { CrawlResult, PageExtract, TechnicalIssuesSummary } from "./types";
import type { TechnicalCard, TechnicalElementScore } from "./types";
import { applyTechnicalNudge } from "./scorer";

const ELEMENT_NAMES: Record<string, string> = {
  jsonLd: "JSON-LD richness",
  metaTags: "Meta tags",
  semanticHtml: "Semantic HTML",
  altText: "Alt text",
  internalLinking: "Internal linking",
  textToCode: "Text-to-code ratio",
  mobileViewport: "Mobile viewport",
  robotsTxt: "Robots.txt — AI allow-list",
  xmlSitemap: "XML sitemap",
};

function partialCrawlSuffix(eligibleCount: number, totalCount: number): string {
  if (eligibleCount === 0 || eligibleCount === totalCount) return "";
  return ` Based on ${eligibleCount} of ${totalCount} successfully fetched pages.`;
}

function appendPartialNote(
  finding: string,
  eligibleCount: number,
  totalCount: number,
): string {
  return finding + partialCrawlSuffix(eligibleCount, totalCount);
}

function scoreJsonLd(pages: PageExtract[], eligibleCount: number, totalCount: number) {
  if (eligibleCount === 0) {
    return {
      score: 0,
      chip: "unverified" as const,
      finding: "No pages could be successfully fetched — structured data not verified.",
      fix: "Verify the site URL is reachable and returns HTML content.",
    };
  }
  const types = new Set<string>();
  let invalidBlocks = 0;
  let totalBlocks = 0;
  for (const p of pages) {
    for (const b of p.structuredData) {
      totalBlocks++;
      b.types.forEach((t) => types.add(t));
      if (!b.valid) invalidBlocks++;
    }
  }
  if (types.size === 0)
    return {
      score: 25,
      chip: "unverified" as const,
      finding:
        "No structured data surfaced in the available output, and none of the obvious schema opportunities appear to be used.",
      fix: "Add LocalBusiness, FAQPage, Service and BreadcrumbList JSON-LD — the single biggest lever for GEO and AEO.",
    };
  let score = Math.min(100, 30 + types.size * 15);
  if (invalidBlocks > 0) {
    score = Math.max(20, score - invalidBlocks * 10);
  }
  const validationNote =
    invalidBlocks > 0
      ? ` ${invalidBlocks} of ${totalBlocks} schema block(s) have validation errors.`
      : "";
  return {
    score,
    chip: invalidBlocks > 0 ? ("inferred" as const) : ("verified" as const),
    finding: appendPartialNote(
      `Found schema types: ${[...types].join(", ")}.${validationNote}`,
      eligibleCount,
      totalCount,
    ),
    fix:
      invalidBlocks > 0
        ? "Fix JSON-LD validation errors (missing @context or required properties) and expand coverage to FAQPage, Service, and BreadcrumbList."
        : "Expand schema coverage to FAQPage, Service, and BreadcrumbList where applicable.",
  };
}

function scoreMetaTags(pages: PageExtract[], eligibleCount: number, totalCount: number) {
  if (eligibleCount === 0) {
    return {
      score: 0,
      chip: "unverified" as const,
      finding: "No pages could be successfully fetched — meta tags not verified.",
      fix: "Verify the site URL is reachable and returns HTML content.",
    };
  }
  const ok = pages.filter(
    (p) =>
      p.title &&
      p.description &&
      p.hasOg &&
      p.hasCanonical &&
      !p.canonicalErrors?.length,
  );
  const canonicalIssues = pages.filter(
    (p) => p.canonicalErrors?.length || (!p.hasCanonical && !p.blocked && p.statusCode < 400),
  ).length;
  const score = Math.round((ok.length / Math.max(pages.length, 1)) * 100);
  const baseFinding =
    canonicalIssues > 0
      ? `${canonicalIssues} page(s) have missing or conflicting canonical tags.`
      : score >= 80
        ? "Unique title + description per page, plus Open Graph, canonical, and viewport tags on most pages."
        : "Some pages lack complete meta tag sets.";
  return {
    score,
    chip: "verified" as const,
    finding: appendPartialNote(baseFinding, eligibleCount, totalCount),
    fix:
      canonicalIssues > 0
        ? "Ensure one self-referencing canonical per page; resolve HTML/header mismatches."
        : "Ensure every page has unique title, description, OG tags, and canonical URL.",
  };
}

function scoreSemanticHtml(pages: PageExtract[], eligibleCount: number, totalCount: number) {
  if (eligibleCount === 0) {
    return {
      score: 0,
      chip: "unverified" as const,
      finding: "No pages could be successfully fetched — semantic HTML not verified.",
      fix: "Verify the site URL is reachable and returns HTML content.",
    };
  }
  const good = pages.filter(
    (p) => p.landmarks.includes("main") && p.h1.length === 1 && p.landmarks.length >= 3,
  );
  const score = Math.round((good.length / Math.max(pages.length, 1)) * 100);
  return {
    score: Math.max(score, 50),
    chip: "inferred" as const,
    finding: appendPartialNote(
      "Heading hierarchy and landmark patterns suggest structured content, but semantic tags should be confirmed in raw HTML.",
      eligibleCount,
      totalCount,
    ),
    fix: "Confirm header / nav / main / section / article / footer are real semantic tags, not styled divs.",
  };
}

function scoreAltText(pages: PageExtract[], eligibleCount: number, totalCount: number) {
  if (eligibleCount === 0) {
    return {
      score: 0,
      chip: "unverified" as const,
      finding: "No pages could be successfully fetched — alt text not verified.",
      fix: "Verify the site URL is reachable and returns HTML content.",
    };
  }
  let total = 0;
  let withAlt = 0;
  for (const p of pages) {
    for (const img of p.images) {
      total++;
      if (img.alt.trim()) withAlt++;
    }
  }
  const score = total === 0 ? 100 : Math.round((withAlt / total) * 100);
  return {
    score,
    chip: total > 0 ? ("verified" as const) : ("estimated" as const),
    finding: appendPartialNote(
      score >= 80
        ? "Most images carry descriptive alt text."
        : "Several images lack descriptive alt attributes.",
      eligibleCount,
      totalCount,
    ),
    fix: 'Mark purely decorative icons as alt="" so screen readers and crawlers skip the noise.',
  };
}

function scoreInternalLinking(pages: PageExtract[], eligibleCount: number, totalCount: number) {
  if (eligibleCount === 0) {
    return {
      score: 0,
      chip: "unverified" as const,
      finding: "No pages could be successfully fetched — internal linking not verified.",
      fix: "Verify the site URL is reachable and returns HTML content.",
    };
  }
  const avg = pages.reduce((s, p) => s + p.internalLinks.length, 0) / Math.max(pages.length, 1);
  const orphans = pages.filter((p) => p.incomingLinks === 0 && p.url !== pages[0]?.url).length;
  const score = Math.round(Math.min(100, avg * 8 + (pages.length - orphans) * 2));
  return {
    score: Math.min(100, Math.max(40, score)),
    chip: "verified" as const,
    finding: appendPartialNote(
      `Average ${avg.toFixed(1)} internal links per page; ${orphans} orphan pages detected.`,
      eligibleCount,
      totalCount,
    ),
    fix: "Cross-link related pages and deepen the link graph from high-traffic entry points.",
  };
}

function scoreTextToCode(pages: PageExtract[], eligibleCount: number, totalCount: number) {
  if (eligibleCount === 0) {
    return {
      score: 0,
      chip: "unverified" as const,
      finding: "No pages could be successfully fetched — text-to-code ratio not verified.",
      fix: "Verify the site URL is reachable and returns HTML content.",
    };
  }
  const ratios = pages.map((p) =>
    p.htmlLength > 0 ? p.textLength / p.htmlLength : 0,
  );
  const avg = ratios.reduce((a, b) => a + b, 0) / Math.max(ratios.length, 1);
  const score = Math.round(Math.min(100, avg * 400));
  return {
    score: Math.max(40, score),
    chip: "estimated" as const,
    finding: appendPartialNote(
      "Text-to-code ratio estimated from fetched HTML; raw source may differ.",
      eligibleCount,
      totalCount,
    ),
    fix: "Minify and defer template CSS/JS; confirm visible-text ratio above ~15% on raw source.",
  };
}

function scoreViewport(pages: PageExtract[], eligibleCount: number, totalCount: number) {
  if (eligibleCount === 0) {
    return {
      score: 0,
      chip: "unverified" as const,
      finding: "No pages could be successfully fetched — viewport meta not verified.",
      fix: "Verify the site URL is reachable and returns HTML content.",
    };
  }
  const ok = pages.filter((p) => p.hasViewport);
  const score = Math.round((ok.length / Math.max(pages.length, 1)) * 100);
  return {
    score,
    chip: "verified" as const,
    finding: appendPartialNote(
      score === 100
        ? "Correct width=device-width viewport on every crawled page."
        : "Some pages missing viewport meta.",
      eligibleCount,
      totalCount,
    ),
    fix: score === 100 ? "None needed — keep as is." : "Add viewport meta to all pages.",
  };
}

function scoreRobots(crawl: CrawlResult, eligibleCount: number) {
  if (!crawl.robotsTxt.fetched) {
    if (eligibleCount === 0) {
      return {
        score: 0,
        chip: "unverified" as const,
        finding: "robots.txt could not be retrieved — crawl could not confirm site reachability.",
        fix: "Verify the site URL is reachable, then publish robots.txt allowing major AI crawlers.",
      };
    }
    return {
      score: 40,
      chip: "verified" as const,
      finding: "robots.txt not found or returned an error response.",
      fix: "Publish robots.txt explicitly allowing GPTBot, ClaudeBot, PerplexityBot, Google-Extended and CCBot.",
    };
  }
  return {
    score: crawl.robotsTxt.aiBotScore,
    chip: "verified" as const,
    finding: crawl.robotsTxt.allowsAiBots
      ? "robots.txt allows major AI crawlers."
      : "robots.txt may block some AI crawlers.",
    fix: "Explicitly allow major LLM bots in robots.txt.",
  };
}

function scoreSitemap(crawl: CrawlResult, eligibleCount: number) {
  if (!crawl.sitemap.present) {
    if (eligibleCount === 0) {
      return {
        score: 0,
        chip: "unverified" as const,
        finding: "sitemap.xml could not be confirmed — crawl could not verify site reachability.",
        fix: "Verify the site URL is reachable, then publish and reference an XML sitemap.",
      };
    }
    return {
      score: 45,
      chip: "verified" as const,
      finding: "sitemap.xml not found or could not be parsed.",
      fix: "Generate an XML sitemap, reference it in robots.txt, and submit in Search Console.",
    };
  }
  return {
    score: Math.min(100, 60 + Math.min(40, crawl.sitemap.urlCount)),
    chip: "verified" as const,
    finding:
      crawl.sitemap.skippedOffOrigin > 0
        ? `sitemap.xml found with ${crawl.sitemap.urlCount} same-origin URL(s); ${crawl.sitemap.skippedOffOrigin} off-origin URL(s) excluded.`
        : `sitemap.xml found with ${crawl.sitemap.urlCount} URLs.`,
    fix: "Keep sitemap updated when publishing new pages.",
  };
}

export function scoreTechnicalElements(crawl: CrawlResult): TechnicalCard[] {
  const eligible = getEligiblePages(crawl.pages);
  const totalCount = crawl.pages.length;
  const eligibleCount = eligible.length;
  const pages = eligible;

  const scorers = [
    { id: "jsonLd" as const, ...scoreJsonLd(pages, eligibleCount, totalCount) },
    { id: "metaTags" as const, ...scoreMetaTags(pages, eligibleCount, totalCount) },
    { id: "semanticHtml" as const, ...scoreSemanticHtml(pages, eligibleCount, totalCount) },
    { id: "altText" as const, ...scoreAltText(pages, eligibleCount, totalCount) },
    { id: "internalLinking" as const, ...scoreInternalLinking(pages, eligibleCount, totalCount) },
    { id: "textToCode" as const, ...scoreTextToCode(pages, eligibleCount, totalCount) },
    { id: "mobileViewport" as const, ...scoreViewport(pages, eligibleCount, totalCount) },
    { id: "robotsTxt" as const, ...scoreRobots(crawl, eligibleCount) },
    { id: "xmlSitemap" as const, ...scoreSitemap(crawl, eligibleCount) },
  ];

  return scorers.map((s) => ({
    id: s.id,
    name: ELEMENT_NAMES[s.id],
    score: applyTechnicalNudge(s.score, s.chip),
    chip: s.chip,
    finding: s.finding,
    fix: s.fix,
  }));
}

export function buildPerPageFindings(
  pages: PageExtract[],
  technicalIssues?: TechnicalIssuesSummary,
): {
  url: string;
  issues: string[];
}[] {
  const byUrl = new Map<string, string[]>();

  function addIssue(url: string, issue: string) {
    const list = byUrl.get(url) ?? [];
    if (!list.includes(issue)) list.push(issue);
    byUrl.set(url, list);
  }

  for (const p of pages) {
    const issues: string[] = [];
    if (p.fetchError) {
      issues.push(`Fetch failed: ${p.fetchError}${p.fetchErrorDetail ? ` (${p.fetchErrorDetail})` : ""}`);
    }
    if (p.blocked && !p.fetchError) issues.push("Empty or blocked HTML response");
    if (p.statusCode >= 400) issues.push(`HTTP ${p.statusCode} response`);
    if (p.redirectChain.filter((h) => h.status >= 300 && h.status < 400).length >= 2) {
      issues.push("Multi-hop redirect chain");
    }
    if (!p.title) issues.push("Missing page title");
    if (!p.description) issues.push("Missing meta description");
    if (p.h1.length === 0) issues.push("No H1 heading");
    if (p.h1.length > 1) issues.push("Multiple H1 headings");
    if (p.structuredData.length === 0) issues.push("No structured data detected");
    else if (p.structuredData.some((b) => !b.valid)) {
      issues.push("Structured data validation errors");
    }
    if (p.thin) issues.push("Thin content (<200 words)");
    if (!p.hasViewport) issues.push("Missing viewport meta");
    if (!p.hasCanonical && !p.blocked && p.statusCode < 400) {
      issues.push("Missing canonical URL");
    }
    if (p.canonicalErrors?.includes("multiple")) {
      issues.push("Multiple canonical tags");
    }
    if (p.canonicalErrors?.includes("html-header-mismatch")) {
      issues.push("Canonical mismatch between HTML and HTTP header");
    }
    for (const issue of issues) addIssue(p.url, issue);
  }

  if (technicalIssues) {
    const all = [
      ...technicalIssues.redirectChains,
      ...technicalIssues.canonicalErrors,
      ...technicalIssues.hreflangErrors,
      ...technicalIssues.schemaErrors,
    ];
    for (const t of all) {
      addIssue(t.url, t.message);
    }
  }

  const findings: { url: string; issues: string[] }[] = [];
  for (const [url, issues] of byUrl) {
    if (issues.length) findings.push({ url, issues });
  }
  return findings.sort((a, b) => a.url.localeCompare(b.url));
}

export function technicalScoresForAudit(cards: TechnicalCard[]): TechnicalElementScore[] {
  return cards.map(({ id, score, chip, aiNudge }) => ({ id, score, chip, aiNudge }));
}
