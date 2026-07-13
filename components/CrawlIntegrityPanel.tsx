"use client";

import type { AuditReport } from "@/lib/audit/types";
import { ReportDetails } from "./ReportDetails";

const FETCH_ERROR_LABELS: Record<string, string> = {
  TLS_HOST_MISMATCH: "TLS / certificate mismatch",
  DNS_FAILED: "DNS resolution failed",
  TIMEOUT: "Request timed out",
  HTTP_ERROR: "HTTP error",
  TOO_MANY_REDIRECTS: "Too many redirects",
  NETWORK_ERROR: "Network error",
};

const SCOPE_MODE_LABELS: Record<string, string> = {
  "requested-origin": "Requested origin",
  "url-variant": "URL variant resolved",
  "canonical-primary": "Canonical primary domain",
};

function crawlIntegritySummary(report: AuditReport): string {
  const integrity = report.crawlIntegrity;
  if (!integrity) return "Crawl integrity";

  const parts = [
    `${integrity.pagesEligible}/${integrity.pagesDiscovered} pages fetched`,
  ];
  if (integrity.pagesFailed > 0) {
    parts.push(`${integrity.pagesFailed} failed`);
  }
  if (integrity.scopeMode !== "requested-origin") {
    parts.push(SCOPE_MODE_LABELS[integrity.scopeMode] ?? integrity.scopeMode);
  }
  if (integrity.scopeLimitations.length > 0) {
    parts.push("scope limitations");
  }

  return `Crawl integrity (${parts.join(" · ")})`;
}

export function CrawlIntegrityPanel({ report }: { report: AuditReport }) {
  const integrity = report.crawlIntegrity;
  if (!integrity) return null;

  const fetchErrorEntries = Object.entries(integrity.fetchErrors).filter(
    ([, count]) => count > 0,
  );
  const hasWarnings =
    integrity.pagesFailed > 0 ||
    integrity.scopeLimitations.length > 0 ||
    fetchErrorEntries.length > 0 ||
    (integrity.sitemapSkippedOffOriginCount > 0 && integrity.scopeMode !== "canonical-primary") ||
    integrity.requestedUrl !== integrity.effectiveCrawlUrl;

  return (
    <ReportDetails
      className="mt-8 rounded-xl border border-[var(--line)] bg-white p-5"
      summaryClassName="cursor-pointer font-display text-sm font-semibold tracking-wide text-qliqqi-navy uppercase"
      summary={crawlIntegritySummary(report)}
    >
      <p className="mt-2 text-sm text-[var(--muted)]">
        How many pages were discovered, fetched, and included in this audit&apos;s scope.
      </p>

      <div className="mt-4 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
        <Stat label="Pages discovered" value={integrity.pagesDiscovered} />
        <Stat label="Successfully fetched" value={integrity.pagesEligible} good />
        <Stat
          label="Fetch failures"
          value={integrity.pagesFailed}
          warn={integrity.pagesFailed > 0}
        />
        <Stat label="Internal links" value={integrity.internalLinksDiscovered} />
      </div>

      <div className="mt-4 flex flex-wrap gap-4 text-sm text-[var(--muted)]">
        <span>
          <b className="text-[var(--ink)]">Scope</b>{" "}
          {SCOPE_MODE_LABELS[integrity.scopeMode] ?? integrity.scopeMode}
        </span>
        <span>
          <b className="text-[var(--ink)]">robots.txt</b>{" "}
          {integrity.robotsFetched ? "fetched" : "not retrieved"}
        </span>
        <span>
          <b className="text-[var(--ink)]">sitemap</b>{" "}
          {integrity.sitemapPresent
            ? `present (${integrity.sitemapSameOriginCount} same-origin URL${integrity.sitemapSameOriginCount === 1 ? "" : "s"}${
                integrity.sitemapSkippedOffOriginCount > 0
                  ? `; ${integrity.sitemapSkippedOffOriginCount} off-origin skipped`
                  : ""
              })`
            : "not found"}
        </span>
      </div>

      {integrity.urlResolutionNote &&
        integrity.requestedUrl === integrity.effectiveCrawlUrl &&
        integrity.pagesEligible === 0 && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-950">
            <b>URL resolution failed:</b> {integrity.urlResolutionNote}
          </div>
        )}

      {integrity.requestedUrl !== integrity.effectiveCrawlUrl && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <b>
            {integrity.scopeMode === "canonical-primary"
              ? "Canonical primary domain:"
              : "URL resolved:"}
          </b>{" "}
          requested{" "}
          <span className="font-mono text-xs">{integrity.requestedUrl}</span>
          <span className="mx-2">→</span>
          crawled{" "}
          <a
            href={integrity.effectiveCrawlUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-xs text-qliqqi-teal"
          >
            {integrity.effectiveCrawlUrl}
          </a>
          {integrity.canonicalPrimaryDomain && integrity.promotedFromOrigin && (
            <p className="mt-2 text-amber-900">
              Staging origin{" "}
              <span className="font-mono text-xs">{integrity.promotedFromOrigin}</span> declares{" "}
              <span className="font-mono text-xs">{integrity.canonicalPrimaryDomain}</span> as the
              canonical primary domain.
            </p>
          )}
          {integrity.urlResolutionNote &&
            integrity.scopeMode !== "canonical-primary" &&
            !integrity.urlResolutionNote.startsWith("Resolved to ") && (
              <p className="mt-2 text-amber-900">{integrity.urlResolutionNote}</p>
            )}
          {integrity.scopeLimitations[0] && integrity.scopeMode === "canonical-primary" && (
            <p className="mt-2 text-amber-900">{integrity.scopeLimitations[0]}</p>
          )}
        </div>
      )}

      {fetchErrorEntries.length > 0 && (
        <div className="mt-4">
          <h4 className="font-display text-xs font-semibold tracking-wide text-qliqqi-navy uppercase">
            Fetch errors
          </h4>
          <ul className="mt-2 space-y-1 text-sm text-[var(--muted)]">
            {fetchErrorEntries.map(([code, count]) => (
              <li key={code}>
                {FETCH_ERROR_LABELS[code] ?? code}: {count} page(s)
              </li>
            ))}
          </ul>
        </div>
      )}

      {integrity.scopeLimitations.length > 0 && (
        <div className="mt-4">
          <h4 className="font-display text-xs font-semibold tracking-wide text-qliqqi-navy uppercase">
            Scope limitations
          </h4>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[var(--muted)]">
            {integrity.scopeLimitations.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </div>
      )}

      {!hasWarnings && (
        <p className="mt-4 text-sm text-[var(--muted)]">
          All discovered pages were successfully fetched from the effective crawl origin.
        </p>
      )}
    </ReportDetails>
  );
}

function Stat({
  label,
  value,
  good,
  warn,
}: {
  label: string;
  value: number;
  good?: boolean;
  warn?: boolean;
}) {
  return (
    <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2">
      <div className="text-xs text-[var(--faint)]">{label}</div>
      <div
        className={`mt-1 font-display text-2xl font-bold ${
          warn ? "text-amber-700" : good ? "text-qliqqi-teal" : "text-qliqqi-navy"
        }`}
      >
        {value}
      </div>
    </div>
  );
}
