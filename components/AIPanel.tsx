"use client";

import type { AuditReport } from "@/lib/audit/types";
import { PremiumGauge } from "./PremiumGauge";

interface AIPanelProps {
  report: AuditReport;
}

export function AIPanel({ report }: AIPanelProps) {
  const crawlBlocked = (report.crawlIntegrity?.pagesEligible ?? 1) === 0;
  const aiUnavailable =
    !crawlBlocked && report.meta.providersFailed.length >= 3;

  const cells = report.panelContent;

  return (
    <section className="mt-14">
      {/* Title */}
      <div className="mb-6">
        <span className="text-[11px] font-semibold tracking-[0.25em] text-[#113255] uppercase block mb-1">
          AI & SEO READINESS
        </span>
        <h2 className="font-serif text-3xl font-bold text-[#07111F] leading-tight">
          AI-Visibility & SEO Diagnostics
        </h2>
        <p className="mt-2 text-sm text-slate-500 font-light max-w-2xl leading-relaxed">
          Consolidated findings and fixes for generative answer engines and
          traditional search crawlers.
        </p>
      </div>

      {/* Warnings */}
      {crawlBlocked && (
        <div className="mb-6 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 leading-relaxed font-light">
          <b>AI visibility analysis skipped.</b>{" "}
          {report.crawlIntegrity?.scopeLimitations.find((n) =>
            n.includes("Lighthouse and AI"),
          ) ??
            "The crawl did not retrieve sufficient page content — AI scores were not generated."}
        </div>
      )}

      {aiUnavailable && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 leading-relaxed font-light">
          <b>AI visibility scores unavailable.</b> Add{" "}
          <code className="rounded bg-white border border-amber-100 px-1 font-mono text-xs">
            ANTHROPIC_API_KEY
          </code>
          ,{" "}
          <code className="rounded bg-white border border-amber-100 px-1 font-mono text-xs">
            XAI_API_KEY
          </code>
          , and{" "}
          <code className="rounded bg-white border border-amber-100 px-1 font-mono text-xs">
            OPENAI_API_KEY
          </code>{" "}
          to{" "}
          <code className="rounded bg-white border border-amber-100 px-1 font-mono text-xs">
            .env.local
          </code>
          , then restart the dev server.
        </div>
      )}

      {/* Gauges Card */}
      {!crawlBlocked &&
        !aiUnavailable &&
        cells.seo &&
        cells.geo &&
        cells.aeo &&
        cells.structured && (
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 md:p-8 mb-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-0 sm:divide-y-0 sm:divide-x divide-slate-100 hover:shadow-md transition-shadow">
            {/* SEO Rating */}
            <div className="flex flex-col items-center text-center p-3">
              <div className="text-[10px] tracking-widest text-slate-400 uppercase font-bold mb-3">
                SEO RATING
              </div>
              <PremiumGauge score={cells.seo.score} />
              <p className="mt-4 text-xs text-slate-500 max-w-[200px] leading-relaxed">
                Search Engine Optimization — standard crawl metrics &
                indexability
              </p>
            </div>

            {/* GEO Score */}
            <div className="flex flex-col items-center text-center p-3">
              <div className="text-[10px] tracking-widest text-slate-400 uppercase font-bold mb-3">
                GEO SCORE
              </div>
              <PremiumGauge score={cells.geo.score} />
              <p className="mt-4 text-xs text-slate-500 max-w-[200px] leading-relaxed">
                Generative Engine Optimization — findability &
                citation-worthiness
              </p>
            </div>

            {/* AEO Score */}
            <div className="flex flex-col items-center text-center p-3">
              <div className="text-[10px] tracking-widest text-slate-400 uppercase font-bold mb-3">
                AEO SCORE
              </div>
              <PremiumGauge score={cells.aeo.score} />
              <p className="mt-4 text-xs text-slate-500 max-w-[200px] leading-relaxed">
                Answer Engine Optimization — direct-answer & FAQ extractability
              </p>
            </div>

            {/* Structured Content */}
            <div className="flex flex-col items-center text-center p-3">
              <div className="text-[10px] tracking-widest text-slate-400 uppercase font-bold mb-3">
                STRUCTURED CONTENT
              </div>
              <PremiumGauge score={cells.structured.score} />
              <p className="mt-4 text-xs text-slate-500 max-w-[200px] leading-relaxed">
                Semantic HTML, schema.org & clean DOM parseability
              </p>
            </div>
          </div>
        )}
    </section>
  );
}
