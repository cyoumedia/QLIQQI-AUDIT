import { auditConfig } from "./config";
import { getEligiblePages } from "./crawler";
import { normalizeUrl } from "./sitemap";
import type {
  LighthouseAuditItem,
  LighthouseCategoryKey,
  LighthouseSeedDiagnostics,
  PageExtract,
  PSIResult,
  ProgressEmitter,
} from "./types";

const PSI_CATEGORIES = [
  "performance",
  "accessibility",
  "best-practices",
  "seo",
] as const;

const LH_CATEGORIES: LighthouseCategoryKey[] = [
  "performance",
  "accessibility",
  "bestPractices",
  "seo",
];

const CATEGORY_KEYS: Record<LighthouseCategoryKey, string> = {
  performance: "performance",
  accessibility: "accessibility",
  bestPractices: "best-practices",
  seo: "seo",
};

function stripHtml(html: string): string {
  const withMarkdownLinks = html.replace(
    /<a\s[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi,
    (_, url, label) => `[${label.replace(/<[^>]+>/g, "").trim()}](${url})`,
  );
  return withMarkdownLinks.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

type RawAudit = {
  id?: string;
  title?: string;
  description?: string;
  displayValue?: string;
  score?: number | null;
  scoreDisplayMode?: string;
};

function auditScore100(audit: RawAudit): number | null {
  if (audit.scoreDisplayMode === "notApplicable") return null;
  if (audit.score == null) return null;
  return Math.round(audit.score * 100);
}

function isFailingAudit(audit: RawAudit): boolean {
  if (audit.scoreDisplayMode === "notApplicable") return false;
  if (audit.scoreDisplayMode === "informative") return false;
  if (audit.score == null) return false;
  if (audit.scoreDisplayMode === "binary") return audit.score < 1;
  return audit.score < 0.9;
}

function extractCategoryAudits(
  cats: Record<string, { auditRefs?: { id: string }[] }>,
  audits: Record<string, RawAudit>,
  maxPerCategory: number,
): Record<LighthouseCategoryKey, LighthouseAuditItem[]> {
  const result = {} as Record<LighthouseCategoryKey, LighthouseAuditItem[]>;

  for (const key of LH_CATEGORIES) {
    const catKey = CATEGORY_KEYS[key];
    const refs = cats[catKey]?.auditRefs ?? [];
    const items: LighthouseAuditItem[] = [];

    for (const ref of refs) {
      const audit = audits[ref.id];
      if (!audit?.title || !isFailingAudit(audit)) continue;
      items.push({
        id: ref.id,
        title: audit.title,
        description: stripHtml(audit.description ?? "").slice(0, 400),
        displayValue: audit.displayValue,
        score: auditScore100(audit),
      });
    }

    items.sort((a, b) => (a.score ?? 100) - (b.score ?? 100));
    result[key] = items.slice(0, maxPerCategory);
  }

  return result;
}

function toOpportunities(
  categoryAudits: Record<LighthouseCategoryKey, LighthouseAuditItem[]>,
): Record<string, { title: string; description: string }[]> {
  const opps: Record<string, { title: string; description: string }[]> = {};
  for (const key of LH_CATEGORIES) {
    opps[key] = categoryAudits[key].slice(0, 3).map((a) => ({
      title: a.title,
      description: a.description,
    }));
  }
  return opps;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Crawled URL for the seed page (handles www / redirect variants). */
export function resolveSeedPsiUrl(pages: PageExtract[], seedUrl: string): string | undefined {
  const seedNorm = normalizeUrl(seedUrl);
  for (const p of getEligiblePages(pages)) {
    if (normalizeUrl(p.url) === seedNorm || normalizeUrl(p.finalUrl) === seedNorm) {
      return p.url;
    }
  }
  return undefined;
}

export function selectPsiUrls(
  pages: PageExtract[],
  sampleSize: number,
  seedUrl?: string,
): string[] {
  const eligible = getEligiblePages(pages);
  if (eligible.length === 0) return [];

  const sorted = [...eligible].sort((a, b) => b.incomingLinks - a.incomingLinks);
  const picked = new Set<string>();

  const seedPsiUrl = seedUrl ? resolveSeedPsiUrl(pages, seedUrl) : undefined;
  if (seedPsiUrl) picked.add(seedPsiUrl);
  else if (eligible[0]) picked.add(eligible[0].url);

  for (const p of sorted) {
    if (picked.size >= sampleSize) break;
    picked.add(p.url);
  }
  while (picked.size < sampleSize && picked.size < eligible.length) {
    const random = eligible[Math.floor(Math.random() * eligible.length)];
    picked.add(random.url);
  }
  return [...picked].slice(0, sampleSize);
}

interface PsiPageResult {
  performance: number;
  accessibility: number;
  bestPractices: number;
  seo: number;
  categoryAudits: Record<LighthouseCategoryKey, LighthouseAuditItem[]>;
  opportunities: Record<string, { title: string; description: string }[]>;
}

async function parsePsiError(res: Response): Promise<string> {
  try {
    const body = await res.json();
    return body?.error?.message ?? `HTTP ${res.status}`;
  } catch {
    return `HTTP ${res.status}`;
  }
}

async function runPsi(
  url: string,
  apiKey: string | undefined,
  signal?: AbortSignal,
  retries = 2,
): Promise<PsiPageResult> {
  // PSI requires each category as a separate query param — not comma-separated
  const params = new URLSearchParams();
  params.set("url", url);
  params.set("strategy", "mobile");
  for (const cat of PSI_CATEGORIES) {
    params.append("category", cat);
  }
  if (apiKey) params.set("key", apiKey);

  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(
      `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${params}`,
      { signal },
    );

    if (res.status === 429 && attempt < retries) {
      await sleep(2000 * (attempt + 1));
      continue;
    }

    if (!res.ok) {
      const msg = await parsePsiError(res);
      throw new Error(msg);
    }

    const data = await res.json();
    const cats = data.lighthouseResult?.categories ?? {};
    const audits = (data.lighthouseResult?.audits ?? {}) as Record<string, RawAudit>;

    const scores = {
      performance: 0,
      accessibility: 0,
      bestPractices: 0,
      seo: 0,
    };
    for (const key of LH_CATEGORIES) {
      const cat = cats[CATEGORY_KEYS[key]];
      const val = cat?.score != null ? Math.round(cat.score * 100) : 0;
      scores[key] = val;
    }

    const maxPerCategory = auditConfig.psiDiagnosticsMaxPerCategory();
    const categoryAudits = extractCategoryAudits(cats, audits, maxPerCategory);
    const opportunities = toOpportunities(categoryAudits);

    return { ...scores, categoryAudits, opportunities };
  }

  throw new Error("PSI request failed after retries");
}

const EMPTY_SCORES = {
  performance: 0,
  accessibility: 0,
  bestPractices: 0,
};

export async function runLighthouseAudit(
  pages: PageExtract[],
  emit: ProgressEmitter,
  signal?: AbortSignal,
  psiFallbackUrls: string[] = [],
  seedUrl?: string,
): Promise<PSIResult> {
  const eligible = getEligiblePages(pages);
  if (eligible.length === 0 && psiFallbackUrls.length === 0) {
    emit({
      type: "warning",
      message:
        "Lighthouse skipped — no pages were successfully fetched during crawl.",
    });
    return {
      psiSeo: 0,
      status: "skipped",
      error: "No eligible pages for PageSpeed Insights",
      scores: EMPTY_SCORES,
      opportunities: {},
      sampledUrls: [],
      successCount: 0,
      failureCount: 0,
    };
  }

  const apiKey = process.env.GOOGLE_PAGESPEED_API_KEY?.trim() || undefined;
  // Without your own API key, shared Google quota is tiny — sample 1 page sequentially
  const sampleSize = apiKey ? auditConfig.psiSampleSize() : 1;
  const concurrency = apiKey ? auditConfig.psiConcurrency() : 1;
  const urls =
    eligible.length > 0
      ? selectPsiUrls(pages, sampleSize, seedUrl)
      : psiFallbackUrls.slice(0, sampleSize);

  if (eligible.length === 0 && psiFallbackUrls.length > 0) {
    emit({
      type: "warning",
      message:
        "Direct crawl blocked by Cloudflare — running PageSpeed Insights via Google servers on the seed URL.",
    });
  }

  if (!apiKey) {
    emit({
      type: "warning",
      message:
        "GOOGLE_PAGESPEED_API_KEY not set — using shared quota (1 page). Add your key for full Lighthouse sampling.",
    });
  }

  emit({
    type: "log",
    icon: "⚡",
    text: `Dispatching Google PageSpeed API for ${urls.length} page(s) (mobile strategy)…`,
  });

  const results: PsiPageResult[] = [];
  const resultsByUrl = new Map<string, PsiPageResult>();
  let lastError = "";
  let failureCount = 0;

  for (let i = 0; i < urls.length; i += concurrency) {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    const batch = urls.slice(i, i + concurrency);

    for (const url of batch) {
      try {
        const result = await runPsi(url, apiKey, signal);
        results.push(result);
        resultsByUrl.set(normalizeUrl(url), result);
        emit({
          type: "log",
          icon: "✓",
          text: `PSI complete for ${new URL(url).pathname || "/"}`,
        });
      } catch (e) {
        failureCount += 1;
        lastError = e instanceof Error ? e.message : "PSI failed";
        emit({
          type: "log",
          icon: "⚠️",
          text: `PSI failed for ${url}: ${lastError}`,
        });
      }
      if (i + concurrency < urls.length) await sleep(apiKey ? 500 : 1500);
    }
  }

  if (results.length === 0) {
    const needsKey = lastError.toLowerCase().includes("quota");
    emit({
      type: "warning",
      message: needsKey
        ? "Lighthouse failed — Google PSI quota exceeded. Add GOOGLE_PAGESPEED_API_KEY to .env.local and restart."
        : `Lighthouse failed — ${lastError || "no PSI results returned"}`,
    });

    return {
      psiSeo: 0,
      status: "failed",
      error: needsKey
        ? "Google PageSpeed Insights quota exceeded. Add GOOGLE_PAGESPEED_API_KEY to .env.local."
        : lastError || "All PSI requests failed",
      scores: EMPTY_SCORES,
      opportunities: {},
      sampledUrls: urls,
      successCount: 0,
      failureCount,
    };
  }

  const avg = (key: keyof Omit<PsiPageResult, "opportunities" | "categoryAudits">) =>
    Math.round(results.reduce((s, r) => s + r[key], 0) / results.length);

  const psiSeoSiteAverage = avg("seo");
  const seedPsiUrl =
    seedUrl && eligible.length > 0
      ? resolveSeedPsiUrl(pages, seedUrl)
      : urls[0];
  const seedResult = seedPsiUrl ? resultsByUrl.get(normalizeUrl(seedPsiUrl)) : undefined;
  const psiSeo = seedResult?.seo ?? psiSeoSiteAverage;

  let seedDiagnostics: LighthouseSeedDiagnostics | undefined;
  if (seedResult && seedPsiUrl) {
    seedDiagnostics = {
      url: seedPsiUrl,
      scores: {
        performance: seedResult.performance,
        accessibility: seedResult.accessibility,
        bestPractices: seedResult.bestPractices,
        seo: seedResult.seo,
      },
      audits: seedResult.categoryAudits,
    };
  }

  if (results.length > 1 && seedResult && psiSeo !== psiSeoSiteAverage) {
    emit({
      type: "log",
      icon: "📊",
      text: `SEO score ${psiSeo} from seed page (site average across ${results.length} pages: ${psiSeoSiteAverage})`,
    });
  }

  const mergedOpps: Record<string, { title: string; description: string }[]> = {};
  for (const key of ["performance", "accessibility", "bestPractices", "seo"]) {
    const all = results.flatMap((r) => r.opportunities[key] ?? []);
    const seen = new Set<string>();
    mergedOpps[key] = all
      .filter((o) => {
        if (seen.has(o.title)) return false;
        seen.add(o.title);
        return true;
      })
      .slice(0, 3);
  }

  const status =
    failureCount > 0 ? ("partial" as const) : ("ok" as const);

  if (failureCount > 0) {
    emit({
      type: "warning",
      message: `Lighthouse partial — ${results.length} of ${urls.length} PSI requests succeeded.`,
    });
  }

  return {
    psiSeo,
    psiSeoSiteAverage: results.length > 1 ? psiSeoSiteAverage : undefined,
    psiSeedUrl: seedPsiUrl ?? urls[0],
    status,
    error: failureCount > 0 ? lastError : undefined,
    scores: {
      performance: avg("performance"),
      accessibility: avg("accessibility"),
      bestPractices: avg("bestPractices"),
    },
    seedDiagnostics,
    opportunities: mergedOpps,
    sampledUrls: urls,
    successCount: results.length,
    failureCount,
  };
}
