"use client";

import { useEffect, useState } from "react";
import type { AuditReport } from "@/lib/audit/types";
import { scoreColor } from "@/lib/theme";
import { useReportExpand } from "./ReportExpandContext";

const WHY_IT_MATTERS_MAP: Record<string, string> = {
  jsonLd:
    "Structured data feeds explicit entities and relationships directly into LLM knowledge graphs.",
  metaTags:
    "Title, description and OG metadata provide default search snippets and identity definitions.",
  semanticHtml:
    "Proper HTML tags allow AI scraper parsers to correctly distinguish main content from site navigation/footers.",
  altText:
    "Image alt text enables multimodal models to understand visual assets and include them in generative responses.",
  internalLinking:
    "A crawlable internal link graph establishes site structure and distributes domain credibility to internal pages.",
  textToCode:
    "Higher text content ratios prevent semantic noise and ensure faster page processing for crawlers.",
  mobileViewport:
    "Responsive designs ensure readability across devices and form factor validation.",
  robotsTxt:
    "Explicit agent rules allow or block crawlers like GPTBot, ClaudeBot, PerplexityBot, and CCBot.",
  xmlSitemap:
    "A clean XML sitemap helps crawlers discover and prioritize all indexable content.",
  llmsTxt:
    "A dedicated llms.txt file provides clean, structured summaries specifically formatted for LLM crawlers.",
};

export function TechnicalCards({ report }: { report: AuditReport }) {
  return (
    <section className="mt-14">
      {/* Title block */}
      <div className="mb-6">
        <span className="text-[11px] font-semibold tracking-[0.25em] text-[#113255] uppercase block mb-1">
          THE FULL DIAGNOSTIC
        </span>
        <h2 className="font-serif text-3xl font-bold text-[#07111F] leading-tight">
          10 core elements
        </h2>
        <p className="mt-2 text-sm text-slate-500 font-light max-w-2xl leading-relaxed">
          Every signal scored 0–100, with the exact page evidence, the fix, and
          the estimated impact of closing the gap. Expand any card for detail.
        </p>
      </div>

      {/* Card Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {report.technical.map((card) => (
          <TechnicalCard key={card.id} card={card} />
        ))}
      </div>
    </section>
  );
}

function TechnicalCard({ card }: { card: AuditReport["technical"][number] }) {
  const { allExpanded } = useReportExpand();
  const [expanded, setExpanded] = useState(false);
  const [width, setWidth] = useState(0);

  const color = scoreColor(card.score);

  useEffect(() => {
    setExpanded(allExpanded);
  }, [allExpanded]);

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => setWidth(card.score));
    });
    return () => cancelAnimationFrame(id);
  }, [card.score]);

  // Determine impact label and styling based on score
  let impactText = "LOW (ALREADY STRONG)";
  let impactStyle = "bg-emerald-50 text-emerald-700 border-emerald-100";
  if (card.score < 50) {
    impactText = "HIGH (CRITICAL ACTION)";
    impactStyle = "bg-red-50 text-red-750 border-red-100";
  } else if (card.score < 80) {
    impactText = "MEDIUM (RECOMMENDED FIX)";
    impactStyle = "bg-amber-50 text-amber-700 border-amber-100";
  }

  const whyItMatters =
    WHY_IT_MATTERS_MAP[card.id] ||
    "Critical parameter for machine understanding.";

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 flex flex-col justify-between transition-all hover:shadow-md">
      <div>
        {/* Header */}
        <div className="flex items-center justify-between gap-3 mb-2.5">
          <span className="font-serif text-[17px] font-bold text-[#07111F] tracking-tight">
            {card.name}
          </span>
          <span className="font-serif text-[22px] font-bold" style={{ color }}>
            {card.score}
          </span>
        </div>

        {/* Progress Bar */}
        <div className="h-1.5 w-full bg-[#F3EFE9] rounded-full overflow-hidden mb-3">
          <div
            className="h-full rounded-full transition-all duration-[1100ms] ease-out"
            style={{ width: `${width}%`, backgroundColor: color }}
          />
        </div>

        {/* Details Toggle Button */}
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-[#1D538C] font-semibold flex items-center gap-1 cursor-pointer hover:underline"
        >
          
          <span>{expanded ? "Hide detail ↑" : "View Detail →"}</span>
        </button>

        {/* Expandable Details Container */}
        {expanded && (
          <div className="mt-4 pt-4 border-t border-slate-100 space-y-3.5 text-xs text-slate-700">
            {/* Why it matters */}
            <div>
              <div className="text-[9px] tracking-wider text-slate-400 font-bold uppercase mb-1">
                WHY IT MATTERS
              </div>
              <p className="leading-relaxed font-light">{whyItMatters}</p>
            </div>

            {/* Exact page */}
            <div>
              <div className="text-[9px] tracking-wider text-slate-400 font-bold uppercase mb-1">
                EXACT PAGE
              </div>
              <p className="leading-relaxed font-mono bg-slate-50 border border-slate-100/50 p-2 rounded text-[11px] select-all [overflow-wrap:anywhere]">
                {card.finding}
              </p>
            </div>

            {/* Fix */}
            <div>
              <div className="text-[9px] tracking-wider text-slate-400 font-bold uppercase mb-1">
                FIX
              </div>
              <p className="leading-relaxed font-light text-[#07111F]">
                {card.fix}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Impact Badge */}
      {expanded && (
        <div className="mt-4 pt-3 border-t border-slate-100 flex">
          <span
            className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${impactStyle}`}
          >
            IMPACT: {impactText}
          </span>
        </div>
      )}
    </div>
  );
}
