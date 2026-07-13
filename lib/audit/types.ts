import type {
  PanelMetricId,
  ProviderId,
  ProviderMetricScores,
  ScoredPanel,
  TechnicalElementScore,
  AgreementLevel,
} from "./scorer";
import type { CrawlScopeMode } from "./canonical-scope";

export type { CrawlScopeMode };

export type FetchErrorCode =
  | "TLS_HOST_MISMATCH"
  | "DNS_FAILED"
  | "TIMEOUT"
  | "HTTP_ERROR"
  | "TOO_MANY_REDIRECTS"
  | "NETWORK_ERROR";

export type AuditProgressEvent =
  | { type: "progress"; percent: number; phase: string; message: string }
  | {
      type: "stage";
      stage: "discovery" | "lighthouse" | "ai";
      status: "pending" | "active" | "complete";
    }
  | { type: "log"; icon: string; text: string }
  | { type: "budget"; audited: number; discovered: number; message: string }
  | { type: "complete"; report: AuditReport }
  | { type: "error"; message: string }
  | { type: "warning"; message: string };

export interface TechnicalCard extends TechnicalElementScore {
  name: string;
  finding: string;
  fix: string;
}

export interface PanelCellContent {
  score: number;
  label: string;
  sublabel: string;
  finding: string;
  fix: string;
  providerLabel?: string;
  /** Lighthouse-style opportunities — used by the SEO panel cell */
  opportunities?: { title: string; description: string }[];
  /** How the SEO score was derived */
  seoSource?: "psi" | "rules";
  /** Mean PSI SEO across sampled pages — shown under headline when it differs */
  psiSeoSiteAverage?: number;
  /** Pages included in psiSeoSiteAverage */
  psiSampleCount?: number;
  /** Provider spread when agreement is not high (GEO/AEO/Structured) */
  scoreRange?: { min: number; max: number };
  agreement?: AgreementLevel;
  scoringNote?: string;
}

export interface AuditReport {
  schemaVersion: "1.1";
  generatedAt: string;
  meta: {
    auditedUrl: string;
    effectiveCrawlUrl?: string;
    urlResolutionNote?: string;
    domain: string;
    reportDate: string;
    pagesDiscovered: number;
    pagesAnalyzedInDepth: number;
    pageUrls: string[];
    scope: string;
    auditDurationMs?: number;
    providersUsed: ProviderId[];
    providersFailed: ProviderId[];
    providerErrors?: Partial<Record<ProviderId, string>>;
  };
  crawlIntegrity: CrawlIntegrity;
  hero: {
    overall: number;
    verdict: string;
    verdictNuance?: string;
  };
  panel: ScoredPanel;
  panelContent: Record<PanelMetricId, PanelCellContent>;
  technical: TechnicalCard[];
  lighthouse: {
    sampleSize: number;
    strategy: string;
    status: "ok" | "partial" | "failed" | "skipped";
    error?: string;
    psiSeedUrl?: string;
    psiSeoSiteAverage?: number;
    scores: {
      performance: number;
      accessibility: number;
      bestPractices: number;
    };
    seedDiagnostics?: LighthouseSeedDiagnostics;
    opportunities: Record<string, { title: string; description: string }[]>;
  };
  rankedRecommendations: {
    rank: number;
    title: string;
    description: string;
    impact: "high" | "medium" | "low";
    source: "ai" | "rules";
  }[];
  perPageFindings: {
    url: string;
    issues: string[];
    finding?: string;
    fix?: string;
  }[];
  technicalIssues?: TechnicalIssuesSummary;
  unverified: { element: string; reason: string }[];
  /** Full crawl payload — attached only when dev features are enabled. */
  devCrawl?: CrawlResult;
  /** Per-provider panel scores — attached only when dev features are enabled. */
  devProviderScores?: Partial<Record<ProviderId, ProviderMetricScores>>;
}

export type { TechnicalElementScore };

export interface CrawlIntegrity {
  requestedUrl: string;
  effectiveCrawlUrl: string;
  scopeMode: CrawlScopeMode;
  urlResolutionNote?: string;
  canonicalPrimaryDomain?: string;
  promotedFromOrigin?: string;
  pagesDiscovered: number;
  pagesEligible: number;
  pagesFailed: number;
  fetchErrors: Partial<Record<FetchErrorCode, number>>;
  robotsFetched: boolean;
  sitemapPresent: boolean;
  sitemapSameOriginCount: number;
  sitemapSkippedOffOriginCount: number;
  internalLinksDiscovered: number;
  scopeLimitations: string[];
}

export interface RedirectHop {
  url: string;
  status: number;
}

export interface HreflangEntry {
  lang: string;
  url: string;
}

export interface StructuredDataBlock {
  format: "json-ld" | "microdata";
  types: string[];
  valid: boolean;
  errors: string[];
}

export type TechnicalIssueCategory = "redirect" | "canonical" | "hreflang" | "structured-data";

export interface TechnicalIssue {
  category: TechnicalIssueCategory;
  severity: "error" | "warning";
  url: string;
  message: string;
}

export interface TechnicalIssuesSummary {
  redirectChains: TechnicalIssue[];
  canonicalErrors: TechnicalIssue[];
  hreflangErrors: TechnicalIssue[];
  schemaErrors: TechnicalIssue[];
  counts: {
    redirect: number;
    canonical: number;
    hreflang: number;
    "structured-data": number;
    total: number;
  };
}

export interface PageExtract {
  url: string;
  html: string;
  title: string;
  description: string;
  h1: string[];
  headings: string[];
  internalLinks: string[];
  images: { src: string; alt: string }[];
  jsonLdTypes: string[];
  structuredData: StructuredDataBlock[];
  hasViewport: boolean;
  hasCanonical: boolean;
  canonicalUrl?: string;
  canonicalSource?: "html" | "header" | "both" | "none";
  canonicalErrors?: string[];
  hreflang: HreflangEntry[];
  statusCode: number;
  finalUrl: string;
  redirectChain: RedirectHop[];
  hasOg: boolean;
  wordCount: number;
  textLength: number;
  htmlLength: number;
  landmarks: string[];
  thin: boolean;
  blocked: boolean;
  incomingLinks: number;
  /** True when HTML was successfully re-fetched via headless browser (JS shell). */
  browserRendered?: boolean;
  fetchError?: FetchErrorCode;
  fetchErrorDetail?: string;
}

export interface CrawlResult {
  requestedUrl: string;
  seedUrl: string;
  domain: string;
  scopeMode: CrawlScopeMode;
  scopeNote?: string;
  canonicalPrimaryDomain?: string;
  promotedFromOrigin?: string;
  pages: PageExtract[];
  pageUrls: string[];
  analyzedUrls: string[];
  robotsTxt: {
    fetched: boolean;
    content: string;
    aiBotScore: number;
    allowsAiBots: boolean;
  };
  llmsTxt: { present: boolean; content: string };
  sitemap: {
    present: boolean;
    urlCount: number;
    skippedOffOrigin: number;
    offOriginDomains: string[];
  };
}

export type LighthouseCategoryKey = "performance" | "accessibility" | "bestPractices" | "seo";

export interface LighthouseAuditItem {
  id: string;
  title: string;
  description: string;
  displayValue?: string;
  /** Audit score 0–100, or null when not scored */
  score: number | null;
}

export interface LighthouseSeedDiagnostics {
  url: string;
  scores: {
    performance: number;
    accessibility: number;
    bestPractices: number;
    seo: number;
  };
  audits: Record<LighthouseCategoryKey, LighthouseAuditItem[]>;
}

export interface PSIResult {
  /** Lighthouse SEO score for the seed / audited URL (matches manual PSI on that URL). */
  psiSeo: number;
  /** Mean SEO across all sampled pages — present when sample size > 1. */
  psiSeoSiteAverage?: number;
  /** URL used for the headline psiSeo score. */
  psiSeedUrl?: string;
  status: "ok" | "partial" | "failed" | "skipped";
  error?: string;
  /** Category scores averaged across sampled pages (panel gauges). */
  scores: {
    performance: number;
    accessibility: number;
    bestPractices: number;
  };
  /** Full failing-audit list from the seed URL PSI run (reporting only). */
  seedDiagnostics?: LighthouseSeedDiagnostics;
  opportunities: Record<string, { title: string; description: string }[]>;
  sampledUrls: string[];
  successCount: number;
  failureCount: number;
}

export type ProgressEmitter = (event: AuditProgressEvent) => void;
