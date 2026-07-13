"use client";

import { useEffect, useState } from "react";
import type {
  AuditReport,
  LighthouseAuditItem,
  LighthouseCategoryKey,
  AgenticBrowsingReport,
} from "@/lib/audit/types";
import { LinkedText } from "./LinkedText";
import { useReportExpand } from "./ReportExpandContext";
import { PremiumGauge } from "./PremiumGauge";
import { scoreColor } from "@/lib/theme";

const CATEGORIES: {
  key: "performance" | "accessibility" | "bestPractices";
  label: string;
}[] = [
  { key: "performance", label: "Performance" },
  { key: "accessibility", label: "Accessibility" },
  { key: "bestPractices", label: "Best Practices" },
];

function seedPath(url: string | undefined): string {
  if (!url) return "/";
  try {
    return new URL(url).pathname || "/";
  } catch {
    return url;
  }
}

function AuditRow({ audit }: { audit: LighthouseAuditItem }) {
  return (
    <li className="p-3 bg-slate-50 border border-slate-100/50 rounded-lg break-words [overflow-wrap:anywhere]">
      <b className="block text-slate-800 text-xs font-semibold">
        {audit.title}
      </b>
      {(audit.score != null || audit.displayValue) && (
        <div className="mt-1 font-mono text-[10px] text-slate-400 font-medium">
          {audit.score != null ? `Score: ${audit.score}/100` : null}
          {audit.score != null && audit.displayValue ? " · " : null}
          {audit.displayValue}
        </div>
      )}
      {audit.description ? (
        <p className="mt-1.5 text-slate-500 font-light text-xs leading-relaxed">
          <LinkedText text={audit.description} />
        </p>
      ) : null}
    </li>
  );
}

export function LighthousePanel({ report }: { report: AuditReport }) {
  const { allExpanded } = useReportExpand();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const lh = report.lighthouse;
  const seed = lh.seedDiagnostics;
  const multiPage = lh.sampleSize > 1;
  const ab: AgenticBrowsingReport | undefined = lh.agenticBrowsing;
  const abExpanded = expanded["agenticBrowsing"] || false;

  useEffect(() => {
    if (allExpanded) {
      setExpanded({
        performance: true,
        accessibility: true,
        bestPractices: true,
        agenticBrowsing: true,
      });
    } else {
      setExpanded({});
    }
  }, [allExpanded]);

  function toggleCategory(key: string) {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function toggleAgenticBrowsing() {
    setExpanded((prev) => ({ ...prev, agenticBrowsing: !prev.agenticBrowsing }));
  }

  function seedScore(key: LighthouseCategoryKey): number | undefined {
    return seed?.scores[key];
  }

  // Cast key to generic string to allow "agenticBrowsing" lookup or standard keys
  function diagnosticsFor(key: string): LighthouseAuditItem[] {
    if (key === "agenticBrowsing") {
      return ab?.audits ?? [];
    }
    return seed?.audits[key as LighthouseCategoryKey] ?? [];
  }

  return (
    <section className="mt-14">
      {/* Title */}
      <div className="mb-6">
        <span className="text-[11px] font-semibold tracking-[0.25em] text-[#113255] uppercase block mb-1">
          GOOGLE CORE METRICS
        </span>
        <h2 className="font-serif text-3xl font-bold text-[#07111F] leading-tight">
          Google PageSpeed & Lighthouse
        </h2>
        <p className="mt-2 text-sm text-slate-500 font-light max-w-2xl leading-relaxed">
          PSI performance analysis (mobile strategy)
          {multiPage
            ? ` averaged across ${lh.sampleSize} sampled pages`
            : ` (1 page sampled)`}
          {seed ? (
            <>
              {" · diagnostics from seed "}
              <code className="rounded bg-slate-50 border border-slate-200/65 px-1.5 py-0.5 font-mono text-xs select-all text-slate-650">
                {seedPath(seed.url)}
              </code>
            </>
          ) : null}
        </p>
      </div>

      {/* Warnings */}
      {lh.status === "failed" && (
        <div className="mb-6 rounded-xl border border-amber-250 bg-amber-50 px-4 py-3 text-sm text-amber-900 leading-relaxed font-light">
          <b>Lighthouse data unavailable.</b>{" "}
          {lh.error ?? "PSI requests failed."} Add{" "}
          <code className="rounded bg-white border border-amber-100 px-1 font-mono text-xs">
            GOOGLE_PAGESPEED_API_KEY
          </code>{" "}
          to{" "}
          <code className="rounded bg-white border border-amber-100 px-1 font-mono text-xs">
            .env.local
          </code>
          , enable PageSpeed Insights API in Google Cloud, then restart{" "}
          <code className="rounded bg-white border border-amber-100 px-1 font-mono text-xs">
            npm run dev
          </code>
          .
        </div>
      )}
      {lh.status === "skipped" && (
        <div className="mb-6 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 leading-relaxed font-light">
          <b>Lighthouse skipped.</b>{" "}
          {lh.error ??
            "No pages were successfully fetched during crawl — PSI was not run."}
        </div>
      )}
      {lh.status === "partial" && lh.error && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 leading-relaxed font-light">
          Partial Lighthouse results — some PSI requests failed ({lh.error}).
        </div>
      )}

      {/* Performance Card with Gauges */}
      {lh.status !== "failed" && lh.status !== "skipped" && (
        <>
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 md:p-8 grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-0 sm:divide-y-0 sm:divide-x divide-slate-100 hover:shadow-md transition-shadow">
            {CATEGORIES.map(({ key, label }) => {
              const siteScore = lh.scores[key];
              const seedOnly = seedScore(key);
              const showSeedNote =
                multiPage && seedOnly != null && seedOnly !== siteScore;
              const color = scoreColor(siteScore);

              return (
                <div
                  key={key}
                  className="flex flex-col items-center text-center p-3"
                >
                  {/* Category label */}
                  <div className="text-[10px] tracking-widest text-slate-400 uppercase font-bold mb-1">
                    {label}
                  </div>

                  {/* Seed score note */}
                  <div className="h-4 font-mono text-[9px] text-slate-400 font-medium mb-2.5">
                    {showSeedNote ? `Seed: ${seedOnly}/100` : ""}
                  </div>

                  {/* Circular Gauge */}
                  <PremiumGauge score={siteScore} color={color} />

                  {/* Toggle details button */}
                  <button
                    type="button"
                    onClick={() => toggleCategory(key)}
                    className="mt-5 text-xs text-[#1D538C] font-semibold flex items-center gap-1 cursor-pointer hover:underline"
                  >
                    <span>Diagnostics</span>
                    <span>{expanded[key] ? "Hide ↑" : "View →"}</span>
                  </button>

                  {/* Collapsible Diagnostics list */}
                  {expanded[key] && (
                    <div className="mt-5 w-full text-left pt-4 border-t border-slate-100">
                      <ul className="max-h-96 space-y-3.5 overflow-y-auto overscroll-y-contain pr-2 text-xs [scrollbar-gutter:stable] scrollbar-thin">
                        {diagnosticsFor(key).map((audit) => (
                          <AuditRow key={audit.id} audit={audit} />
                        ))}
                        {diagnosticsFor(key).length === 0 && (
                          <li className="text-slate-400 font-light text-center py-2">
                            No failing audits flagged.
                          </li>
                        )}
                      </ul>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Agentic Browsing Premium Card */}
          <div className="mt-6 bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 md:p-8 hover:shadow-md transition-shadow">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-3">
                  <span className="text-[10px] tracking-widest text-slate-400 uppercase font-bold">
                    EXPERIMENTAL CAPABILITY
                  </span>
                </div>
                <h3 className="font-serif text-xl font-bold text-[#07111F]">
                  {ab?.title ?? "Agentic Browsing"}
                </h3>
                <p className="text-xs text-slate-500 font-light max-w-2xl leading-relaxed">
                  {ab?.available && ab.description ? (
                    <LinkedText text={ab.description} />
                  ) : (
                    "This Lighthouse version does not expose Agentic Browsing results."
                  )}
                </p>

                {ab?.available && (
                  <button
                    type="button"
                    onClick={toggleAgenticBrowsing}
                    className="mt-3 text-xs text-[#1D538C] font-semibold flex items-center gap-1 cursor-pointer hover:underline"
                  >
                    
                    <span>{abExpanded ? "↑ Hide" : " → View"}</span>
                    <span> Diagnostics</span>
                  </button>
                )}
              </div>

              {/* Large pass ratio numeral / status on the right */}
              <div className="flex flex-col items-center justify-center text-center p-4 bg-slate-50 border border-slate-100 rounded-2xl min-w-[140px] md:min-w-[160px] self-stretch md:self-auto">
                {ab?.available ? (
                  <>
                    <span className={`font-display text-4xl md:text-5xl font-extrabold tracking-tight ${
                      ab.passed === ab.total ? "text-emerald-500" : "text-amber-505 text-amber-500"
                    }`}>
                      {ab.passed}/{ab.total}
                    </span>
                    <span className="text-[9px] tracking-wider text-slate-400 font-bold uppercase mt-2">
                      PASSED CHECKS
                    </span>
                  </>
                ) : (
                  <>
                    <span className="font-display text-2xl md:text-3xl font-bold text-slate-400 tracking-tight uppercase">
                      N/A
                    </span>
                    <span className="text-[9px] tracking-wider text-slate-400 font-bold uppercase mt-2">
                      UNAVAILABLE
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Collapsible Diagnostics list */}
            {ab?.available && abExpanded && (
              <div className="mt-6 pt-6 border-t border-slate-100">
                <div className="text-[10px] tracking-widest text-slate-400 uppercase font-bold mb-3">
                  Agentic Browsing Diagnostics
                </div>
                <ul className="max-h-96 space-y-3.5 overflow-y-auto overscroll-y-contain pr-2 text-xs [scrollbar-gutter:stable] scrollbar-thin">
                  {diagnosticsFor("agenticBrowsing").map((audit) => (
                    <AuditRow key={audit.id} audit={audit} />
                  ))}
                  {diagnosticsFor("agenticBrowsing").length === 0 && (
                    <li className="text-slate-400 font-light text-center py-4 bg-slate-50 border border-slate-100/50 rounded-xl">
                      All agentic readiness checks passed successfully. No failing audits flagged.
                    </li>
                  )}
                </ul>
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}
