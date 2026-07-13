"use client";

import Image from "next/image";
import type { AuditReport } from "@/lib/audit/types";
import { scoreColor } from "@/lib/theme";

interface AICredibilityPanelProps {
  report: AuditReport;
}

export function AICredibilityPanel({ report }: AICredibilityPanelProps) {
  const { panel } = report;
  const aiMetrics = panel.meta?.aiMetrics;

  if (!aiMetrics) return null;

  // Extract individual provider scores safely
  const providers = [
    {
      id: "claude" as const,
      name: "Claude",
      logo: "/brand/claude.svg",
      scores: {
        geo: aiMetrics.geo?.rawByProvider?.claude,
        aeo: aiMetrics.aeo?.rawByProvider?.claude,
        structured: aiMetrics.structured?.rawByProvider?.claude,
      },
    },
    {
      id: "openai" as const,
      name: "ChatGPT",
      logo: "/brand/chatgpt.svg",
      scores: {
        geo: aiMetrics.geo?.rawByProvider?.openai,
        aeo: aiMetrics.aeo?.rawByProvider?.openai,
        structured: aiMetrics.structured?.rawByProvider?.openai,
      },
    },
    {
      id: "grok" as const,
      name: "Grok",
      logo: "/brand/grok.svg",
      scores: {
        geo: aiMetrics.geo?.rawByProvider?.grok,
        aeo: aiMetrics.aeo?.rawByProvider?.grok,
        structured: aiMetrics.structured?.rawByProvider?.grok,
      },
    },
  ];

  return (
    <section className="mt-14">
      {/* Title */}
      <div className="mb-6">
        <span className="text-[11px] font-semibold tracking-[0.25em] text-[#113255] uppercase block mb-1">
          AI ENGINE BREAKDOWN
        </span>
        <h2 className="font-serif text-3xl font-bold text-[#07111F] leading-tight">
          LLM Engine Visibility & Credibility
        </h2>
        <p className="mt-2 text-sm text-slate-500 font-light max-w-2xl leading-relaxed">
          Detailed crawl performance and citation scores evaluated across
          individual AI model architectures.
        </p>
      </div>

      {/* Grid of Providers */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {providers.map((p) => {
          const validScores = Object.values(p.scores).filter(
            (v) => typeof v === "number",
          ) as number[];

          if (validScores.length === 0) return null;

          // Calculate average provider score
          const avgScore = Math.round(
            validScores.reduce((sum, val) => sum + val, 0) / validScores.length,
          );
          const overallColor = scoreColor(avgScore);

          return (
            <div
              key={p.id}
              className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 flex flex-col justify-between hover:shadow-md transition-shadow"
            >
              <div>
                {/* Brand Header */}
                <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="relative w-9 h-9 flex items-center justify-center bg-slate-50 rounded-lg p-1.5 border border-slate-100">
                      <Image
                        src={p.logo}
                        alt={p.name}
                        width={28}
                        height={28}
                        className="object-contain"
                      />
                    </div>
                    <span className="font-serif text-[17px] font-bold text-[#07111F]">
                      {p.name}
                    </span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span
                      className="font-serif text-[24px] font-bold"
                      style={{ color: overallColor }}
                    >
                      {avgScore}
                    </span>
                    <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">
                      Avg Score
                    </span>
                  </div>
                </div>

                {/* Sub-metrics Breakdown */}
                <div className="space-y-4">
                  {/* GEO */}
                  {typeof p.scores.geo === "number" && (
                    <div>
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="text-slate-500 font-medium">
                          Generative Engine Optimization (GEO)
                        </span>
                        <span className="font-semibold text-[#07111F]">
                          {p.scores.geo}
                        </span>
                      </div>
                      <div className="h-1 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-[1000ms] ease-out"
                          style={{
                            width: `${p.scores.geo}%`,
                            backgroundColor: scoreColor(p.scores.geo),
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {/* AEO */}
                  {typeof p.scores.aeo === "number" && (
                    <div>
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="text-slate-500 font-medium">
                          Answer Engine Optimization (AEO)
                        </span>
                        <span className="font-semibold text-[#07111F]">
                          {p.scores.aeo}
                        </span>
                      </div>
                      <div className="h-1 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-[1000ms] ease-out"
                          style={{
                            width: `${p.scores.aeo}%`,
                            backgroundColor: scoreColor(p.scores.aeo),
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Structured Content */}
                  {typeof p.scores.structured === "number" && (
                    <div>
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="text-slate-500 font-medium">
                          Structured Content
                        </span>
                        <span className="font-semibold text-[#07111F]">
                          {p.scores.structured}
                        </span>
                      </div>
                      <div className="h-1 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-[1000ms] ease-out"
                          style={{
                            width: `${p.scores.structured}%`,
                            backgroundColor: scoreColor(p.scores.structured),
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Verified Badge */}
              <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400 font-medium">
                <span>
                  Model Engine:{" "}
                  {p.id === "openai"
                    ? "GPT-5 Search"
                    : p.id === "claude"
                      ? "Claude Sonnet"
                      : "Grok 2"}
                </span>
                <span className="text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100/50">
                  Active
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
