import { runAllProviders } from "./ai";
import type { AIAuditResult } from "./ai/schema";
import { closeBrowserFetcher } from "./browser-fetch";
import { auditConfig, devFeaturesEnabled } from "./config";
import {
  buildUnresolvedCrawl,
  crawlFailedVerdict,
  evaluateCrawlGate,
  partialCrawlVerdictSuffix,
  skippedPsiResult,
} from "./crawl-gate";
import { computeCrawlConfidence } from "./crawl-confidence";
import { crawlSite, getEligiblePages } from "./crawler";
import { runLighthouseAudit } from "./lighthouse";
import { analyzeTechnicalIssues } from "./technical/analyze";
import { buildRankedRecommendations } from "./recommendations";
import { resolveAuditUrl } from "./url-resolve";
import {
  buildPerPageFindings,
  scoreTechnicalElements,
  technicalScoresForAudit,
} from "./rules";
import {
  checkRateLimit,
  normalizeAuditUrl,
  assertSafeUrl,
} from "./security";
import {
  computeRulesSeoProxy,
  scoreAudit,
  verdictForScore,
  type AiPanelMetricId,
  type PanelMetricId,
  type ProviderId,
  type ProviderMetricScores,
  SEO_PROXY_ELEMENTS,
} from "./scorer";
import { providerLabel } from "../theme";
import type { AuditReport, CrawlIntegrity, CrawlResult, PanelCellContent, ProgressEmitter, PSIResult, TechnicalCard } from "./types";
import type { UrlResolution } from "./url-resolve";

const PANEL_LABELS: Record<PanelMetricId, { label: string; sublabel: string }> = {
  seo: { label: "SEO", sublabel: "Search Engine Opt." },
  geo: { label: "GEO", sublabel: "Generative Engine Opt." },
  aeo: { label: "AEO", sublabel: "Answer Engine Opt." },
  structured: { label: "Structured Content", sublabel: "Organisation & hierarchy" },
};

function verdictNuance(panel: { geo: number; aeo: number; structured: number }): string | undefined {
  const min = Math.min(panel.geo, panel.aeo, panel.structured);
  if (min < 60) return "AI layer thin";
  if (min < 70) return "room to improve AI visibility";
  return undefined;
}

function dedupeOpportunities(
  items: { title: string; description: string }[],
): { title: string; description: string }[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = item.title.toLowerCase().slice(0, 40);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildSeoOpportunities(
  psi: PSIResult,
  technical: TechnicalCard[],
  seoSource: "psi" | "rules",
): { title: string; description: string }[] {
  const fromRules = technical
    .filter((t) => SEO_PROXY_ELEMENTS.includes(t.id) && t.score < 90)
    .sort((a, b) => a.score - b.score)
    .map((t) => ({
      title: t.name,
      description: t.fix || t.finding,
    }));

  const fromPsi = psi.opportunities?.seo ?? [];
  const merged =
    seoSource === "rules"
      ? dedupeOpportunities([...fromRules, ...fromPsi])
      : dedupeOpportunities([...fromPsi, ...fromRules]);

  return merged.slice(0, 3);
}

function formatAiProviderLabel(
  meta: ReturnType<typeof scoreAudit>["panel"]["meta"]["aiMetrics"][AiPanelMetricId],
): string | undefined {
  if (!meta.winner || meta.agreement !== "high") return undefined;

  return `via ${providerLabel(meta.winner)}`;
}

function buildPanelContent(
  panel: ReturnType<typeof scoreAudit>["panel"],
  providerData: Partial<Record<ProviderId, AIAuditResult>>,
  psi: PSIResult,
  technical: TechnicalCard[],
): Record<PanelMetricId, PanelCellContent> {
  const aiMetrics: AiPanelMetricId[] = ["geo", "aeo", "structured"];
  const result = {} as Record<PanelMetricId, PanelCellContent>;

  result.seo = {
    score: panel.seo,
    label: PANEL_LABELS.seo.label,
    sublabel: PANEL_LABELS.seo.sublabel,
    finding: "",
    fix: "",
    seoSource: panel.meta.seoSource,
    providerLabel:
      panel.meta.seoSource === "psi"
        ? "Lighthouse · PageSpeed Insights"
        : "Estimated from on-page crawl rules",
    opportunities: buildSeoOpportunities(psi, technical, panel.meta.seoSource),
    ...(panel.meta.seoSource === "psi" &&
    psi.psiSeoSiteAverage != null &&
    psi.psiSeoSiteAverage !== panel.seo
      ? {
          psiSeoSiteAverage: psi.psiSeoSiteAverage,
          psiSampleCount: psi.successCount,
        }
      : {}),
  };

  for (const m of aiMetrics) {
    const metricMeta = panel.meta.aiMetrics[m];
    const winner = metricMeta.winner;
    const data = winner ? providerData[winner] : undefined;
    const metricKey = m === "structured" ? "structured" : m;
    const content = data?.[metricKey as keyof AIAuditResult] as
      | { finding: string; fix: string }
      | undefined;

    const confidenceNote =
      panel.meta.crawlConfidence.level !== "high"
        ? `Partial crawl (${Math.round(panel.meta.crawlConfidence.coverageRatio * 100)}% pages)`
        : undefined;

    result[m] = {
      score: panel[m],
      label: PANEL_LABELS[m].label,
      sublabel: PANEL_LABELS[m].sublabel,
      finding: content?.finding ?? "Analysis based on crawl data and provider consensus.",
      fix: content?.fix ?? "Review page structure and schema coverage.",
      providerLabel: formatAiProviderLabel(metricMeta),
      scoreRange: metricMeta.agreement !== "high" ? metricMeta.range : undefined,
      agreement: metricMeta.agreement,
      scoringNote: confidenceNote,
    };
  }

  return result;
}

function buildSkippedPanelContent(reason: string): Record<PanelMetricId, PanelCellContent> {
  const result = {} as Record<PanelMetricId, PanelCellContent>;
  result.seo = {
    score: 0,
    label: PANEL_LABELS.seo.label,
    sublabel: PANEL_LABELS.seo.sublabel,
    finding: "",
    fix: "",
    seoSource: "rules",
    providerLabel: "Skipped — crawl integrity gate",
    opportunities: [],
  };
  const aiMetrics: AiPanelMetricId[] = ["geo", "aeo", "structured"];
  for (const m of aiMetrics) {
    result[m] = {
      score: 0,
      label: PANEL_LABELS[m].label,
      sublabel: PANEL_LABELS[m].sublabel,
      finding: reason,
      fix: "Verify the site URL is reachable and returns HTML content, then re-run the audit.",
      providerLabel: "Skipped — crawl integrity gate",
    };
  }
  return result;
}

function buildCrawlIntegrity(resolution: UrlResolution, crawl: CrawlResult): CrawlIntegrity {
  const eligible = getEligiblePages(crawl.pages);
  const fetchErrors: CrawlIntegrity["fetchErrors"] = {};
  for (const page of crawl.pages) {
    if (!page.fetchError) continue;
    fetchErrors[page.fetchError] = (fetchErrors[page.fetchError] ?? 0) + 1;
  }
  if (!resolution.resolved && eligible.length === 0) {
    for (const candidate of resolution.candidatesTried) {
      if (!candidate.error) continue;
      fetchErrors[candidate.error] = (fetchErrors[candidate.error] ?? 0) + 1;
    }
  }

  const internalLinkSet = new Set<string>();
  for (const page of crawl.pages) {
    for (const link of page.internalLinks) internalLinkSet.add(link);
  }

  const scopeLimitations: string[] = [];
  if (crawl.scopeMode === "canonical-primary" && crawl.promotedFromOrigin) {
    scopeLimitations.push(
      crawl.scopeNote ??
        `Requested URL appears to be staging for ${crawl.canonicalPrimaryDomain ?? "production"}; crawled declared canonical primary domain instead of ${crawl.promotedFromOrigin}.`,
    );
  }
  if (eligible.length > 0 && eligible.length < crawl.pages.length) {
    scopeLimitations.push(
      `Partial crawl: ${eligible.length} of ${crawl.pages.length} discovered pages were successfully fetched.`,
    );
  }
  if (eligible.length === 0) {
    scopeLimitations.push("No pages were successfully fetched — technical scores are unverified.");
  }
  if (
    crawl.scopeMode !== "canonical-primary" &&
    crawl.sitemap.skippedOffOrigin > 0
  ) {
    const domainNote =
      crawl.sitemap.offOriginDomains.length > 0
        ? ` (${crawl.sitemap.offOriginDomains.join(", ")})`
        : "";
    scopeLimitations.push(
      `Sitemap listed ${crawl.sitemap.skippedOffOrigin} off-origin URL(s)${domainNote} — not included in crawl scope.`,
    );
  }

  return {
    requestedUrl: resolution.requestedUrl,
    effectiveCrawlUrl: crawl.seedUrl,
    scopeMode: crawl.scopeMode,
    urlResolutionNote: resolution.note,
    canonicalPrimaryDomain: crawl.canonicalPrimaryDomain,
    promotedFromOrigin: crawl.promotedFromOrigin,
    pagesDiscovered: crawl.pages.length,
    pagesEligible: eligible.length,
    pagesFailed: crawl.pages.length - eligible.length,
    fetchErrors,
    robotsFetched: crawl.robotsTxt.fetched,
    sitemapPresent: crawl.sitemap.present,
    sitemapSameOriginCount: crawl.sitemap.urlCount,
    sitemapSkippedOffOriginCount: crawl.sitemap.skippedOffOrigin,
    internalLinksDiscovered: internalLinkSet.size,
    scopeLimitations,
  };
}

export async function runAudit(
  rawUrl: string,
  clientIp: string,
  emit: ProgressEmitter,
  signal?: AbortSignal,
): Promise<AuditReport> {
  try {
    return await runAuditInner(rawUrl, clientIp, emit, signal);
  } finally {
    await closeBrowserFetcher();
  }
}

async function runAuditInner(
  rawUrl: string,
  clientIp: string,
  emit: ProgressEmitter,
  signal?: AbortSignal,
): Promise<AuditReport> {
  const rate = checkRateLimit(clientIp, auditConfig.rateLimitAuditsPerHour());
  if (!rate.allowed) {
    emit({ type: "error", message: "Rate limit exceeded. Try again later." });
    throw new Error("Rate limit exceeded");
  }

  emit({ type: "stage", stage: "discovery", status: "active" });
  emit({ type: "progress", percent: 5, phase: "VALIDATE", message: "Validating URL…" });

  const requestedUrl = normalizeAuditUrl(rawUrl);
  await assertSafeUrl(requestedUrl);

  emit({ type: "progress", percent: 8, phase: "RESOLVE", message: "Probing URL variants…" });
  const resolution = await resolveAuditUrl(requestedUrl, signal);
  if (resolution.effectiveUrl !== requestedUrl) {
    emit({
      type: "log",
      icon: "🔀",
      text: resolution.note ?? `Using ${resolution.effectiveUrl} for crawl.`,
    });
  }

  let crawl: CrawlResult;
  if (!resolution.resolved) {
    emit({
      type: "warning",
      message: resolution.note ?? "URL resolution failed — skipping full crawl.",
    });
    crawl = buildUnresolvedCrawl(resolution);
  } else {
    emit({ type: "progress", percent: 10, phase: "CRAWL", message: "Discovering site resources…" });
    crawl = await crawlSite(resolution, emit, signal);
  }

  let crawlIntegrity = buildCrawlIntegrity(resolution, crawl);
  const gate = evaluateCrawlGate(resolution, crawl);
  if (gate.abortExpensivePhases && gate.reason) {
    const skipNote = gate.psiFallbackUrls?.length
      ? `Direct crawl and AI analysis skipped: ${gate.reason}. PageSpeed Insights may still run via Google servers.`
      : `Lighthouse and AI analysis skipped: ${gate.reason}.`;
    crawlIntegrity = {
      ...crawlIntegrity,
      scopeLimitations: [
        ...crawlIntegrity.scopeLimitations.filter(
          (note) => !note.includes("Lighthouse and AI") && !note.includes("Direct crawl and AI"),
        ),
        skipNote,
      ],
    };
  }

  emit({ type: "stage", stage: "discovery", status: "complete" });

  const technicalIssues = analyzeTechnicalIssues(crawl);
  const technical = scoreTechnicalElements(crawl);

  let psi: PSIResult;
  let providerResults: Awaited<ReturnType<typeof runAllProviders>>;

  if (gate.abortExpensivePhases) {
    if (gate.psiFallbackUrls?.length) {
      emit({
        type: "warning",
        message: `${gate.reason} — skipping direct crawl and AI; running PageSpeed Insights via Google.`,
      });
      emit({ type: "stage", stage: "lighthouse", status: "active" });
      emit({
        type: "progress",
        percent: 45,
        phase: "LIGHTHOUSE",
        message: "Running Lighthouse audits…",
      });
      psi = await runLighthouseAudit(crawl.pages, emit, signal, gate.psiFallbackUrls, crawl.seedUrl);
      emit({ type: "stage", stage: "lighthouse", status: "complete" });
      emit({ type: "stage", stage: "ai", status: "complete" });
      emit({
        type: "progress",
        percent: 65,
        phase: "SYNTHESIZE",
        message: "Building rules-only report…",
      });
      providerResults = [];
    } else {
      emit({
        type: "warning",
        message: `${gate.reason} — skipping Lighthouse and AI analysis.`,
      });
      emit({ type: "stage", stage: "lighthouse", status: "complete" });
      emit({ type: "stage", stage: "ai", status: "complete" });
      emit({
        type: "progress",
        percent: 65,
        phase: "SYNTHESIZE",
        message: "Building rules-only report…",
      });
      psi = skippedPsiResult(gate.reason ?? "Crawl integrity gate");
      providerResults = [];
    }
  } else {
    emit({ type: "stage", stage: "lighthouse", status: "active" });
    emit({
      type: "progress",
      percent: 45,
      phase: "LIGHTHOUSE",
      message: "Running Lighthouse audits…",
    });

    psi = await runLighthouseAudit(crawl.pages, emit, signal, [], crawl.seedUrl);

    emit({ type: "stage", stage: "lighthouse", status: "complete" });
    emit({ type: "stage", stage: "ai", status: "active" });
    emit({
      type: "progress",
      percent: 65,
      phase: "AI",
      message: "Running AI visibility analysis…",
    });

    emit({ type: "log", icon: "🧠", text: "Running Claude visibility analysis…" });
    emit({ type: "log", icon: "🧠", text: "Running Grok visibility analysis…" });
    emit({ type: "log", icon: "🧠", text: "Running OpenAI visibility analysis…" });

    providerResults = await runAllProviders(
      crawl,
      { crawlIntegrity, technical, technicalIssues },
      signal,
    );
  }

  const providersUsed = providerResults.filter((r) => r.success).map((r) => r.provider);
  const providersFailed = providerResults.filter((r) => !r.success).map((r) => r.provider);
  const providerErrors = Object.fromEntries(
    providerResults
      .filter((r) => !r.success && r.error)
      .map((r) => [r.provider, r.error!]),
  ) as Partial<Record<ProviderId, string>>;

  for (const r of providerResults.filter((x) => !x.success)) {
    emit({
      type: "warning",
      message: `${providerLabel(r.provider)} unavailable${r.error ? `: ${r.error}` : ""}`,
    });
  }

  const providerScores: Partial<Record<ProviderId, ProviderMetricScores>> = {};
  const providerData: Partial<Record<ProviderId, AIAuditResult>> = {};
  for (const r of providerResults) {
    if (r.success && r.data) {
      providerScores[r.provider] = {
        geo: r.data.geo.score,
        aeo: r.data.aeo.score,
        structured: r.data.structured.score,
      };
      providerData[r.provider] = r.data;
    }
  }

  if (!gate.abortExpensivePhases) {
    emit({ type: "stage", stage: "ai", status: "complete" });
  }
  emit({ type: "progress", percent: 85, phase: "SYNTHESIZE", message: "Synthesizing report…" });

  for (const card of technical) {
    for (const r of providerResults) {
      const narrative = r.data?.technicalNarratives?.[card.id];
      if (card.chip === "inferred" || card.chip === "unverified") {
        if (narrative?.finding) card.finding = narrative.finding;
        if (narrative?.fix) card.fix = narrative.fix;
      }
      if (narrative?.nudge && (card.chip === "inferred" || card.chip === "unverified")) {
        card.score = Math.min(100, Math.max(0, card.score + narrative.nudge));
      }
    }
  }

  const technicalForScoring = technicalScoresForAudit(technical);
  const rulesSeoProxy = computeRulesSeoProxy(technicalForScoring);
  const psiUnavailable = psi.status === "skipped" || psi.status === "failed";

  const crawlConfidence = computeCrawlConfidence(crawlIntegrity);

  const scored = scoreAudit(technicalForScoring, {
    providerScores,
    psiSeo: psi.psiSeo,
    rulesSeoProxy,
    psiUnavailable,
    crawlConfidence,
  });

  const nuance = gate.abortExpensivePhases ? undefined : verdictNuance(scored.panel);
  const partialSuffix = partialCrawlVerdictSuffix(crawlIntegrity);
  let verdict: string;
  if (gate.abortExpensivePhases) {
    verdict = crawlFailedVerdict();
  } else if (nuance && partialSuffix) {
    verdict = `${verdictForScore(scored.overall)} · ${partialSuffix} · ${nuance}`;
  } else if (partialSuffix) {
    verdict = `${verdictForScore(scored.overall)} · ${partialSuffix}`;
  } else if (nuance) {
    verdict = `${verdictForScore(scored.overall)} · ${nuance}`;
  } else {
    verdict = verdictForScore(scored.overall);
  }

  const panelContent = gate.abortExpensivePhases
    ? buildSkippedPanelContent(gate.reason ?? "Crawl integrity gate — AI analysis skipped.")
    : buildPanelContent(scored.panel, providerData, psi, technical);

  const topWinner =
    scored.panel.meta.winningProvider.geo ??
    scored.panel.meta.winningProvider.aeo ??
    providersUsed[0] ??
    null;

  const rankedRecommendations = buildRankedRecommendations(
    technical,
    providerResults,
    topWinner,
    crawlIntegrity,
  );

  const unverified = technical
    .filter((t) => t.chip === "unverified")
    .map((t) => ({
      element: t.name,
      reason: "Could not be directly verified from fetched content.",
    }));

  if (psi.status === "failed") {
    unverified.push({
      element: "Lighthouse / PageSpeed Insights",
      reason: psi.error ?? "All PSI requests failed — add GOOGLE_PAGESPEED_API_KEY to .env.local.",
    });
  } else if (psi.status === "skipped") {
    unverified.push({
      element: "Lighthouse / PageSpeed Insights",
      reason: psi.error ?? "Skipped — no pages were successfully fetched during crawl.",
    });
  }

  if (gate.abortExpensivePhases) {
    unverified.push({
      element: "AI visibility analysis",
      reason: gate.reason ?? "Skipped — crawl did not retrieve sufficient page content.",
    });
  } else if (providersFailed.length > 0) {
    for (const r of providerResults.filter((x) => !x.success)) {
      unverified.push({
        element: `${providerLabel(r.provider)} analysis`,
        reason: r.error ?? "Provider unavailable — check API key in .env.local.",
      });
    }
  }

  if (crawl.pages.some((p) => p.blocked && !p.fetchError)) {
    unverified.push({
      element: "SPA / rendered content",
      reason:
        "Some pages returned thin or empty HTML — JavaScript-rendered content may not be fully captured without a headless browser.",
    });
  }

  const failedFetches = crawl.pages.filter((p) => p.fetchError);
  if (failedFetches.length > 0) {
    unverified.push({
      element: "Page fetch failures",
      reason: `${failedFetches.length} page(s) could not be fetched — see crawl integrity for error breakdown.`,
    });
  }

  const report: AuditReport = {
    schemaVersion: "1.1",
    generatedAt: new Date().toISOString(),
    meta: {
      auditedUrl: resolution.requestedUrl,
      effectiveCrawlUrl:
        crawl.seedUrl !== resolution.requestedUrl ? crawl.seedUrl : undefined,
      urlResolutionNote:
        crawl.scopeMode === "canonical-primary"
          ? crawl.scopeNote ?? resolution.note
          : resolution.note,
      domain: crawl.domain,
      reportDate: new Date().toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }),
      pagesDiscovered: crawl.pageUrls.length,
      pagesAnalyzedInDepth: crawl.analyzedUrls.length,
      pageUrls: crawl.pageUrls,
      scope: gate.abortExpensivePhases
        ? "12 elements (rules only — crawl integrity gate)"
        : "12 elements + AI panel + Lighthouse",
      providersUsed,
      providersFailed,
      providerErrors,
    },
    crawlIntegrity,
    hero: {
      overall: scored.overall,
      verdict,
      verdictNuance: nuance,
    },
    panel: scored.panel,
    panelContent,
    technical,
    lighthouse: {
      sampleSize: psi.sampledUrls.length,
      strategy: "seed URL + highest in-degree + random sample",
      status: psi.status,
      error: psi.error,
      psiSeedUrl: psi.psiSeedUrl,
      psiSeoSiteAverage: psi.psiSeoSiteAverage,
      scores: psi.scores,
      seedDiagnostics: psi.seedDiagnostics,
      opportunities: psi.opportunities,
      agenticBrowsing: psi.agenticBrowsing,
    },
    rankedRecommendations,
    perPageFindings: buildPerPageFindings(crawl.pages, technicalIssues),
    technicalIssues,
    unverified,
    ...(devFeaturesEnabled()
      ? { devCrawl: crawl, devProviderScores: providerScores }
      : {}),
  };

  emit({ type: "progress", percent: 100, phase: "COMPLETE", message: "Audit complete" });
  emit({ type: "complete", report });

  return report;
}
