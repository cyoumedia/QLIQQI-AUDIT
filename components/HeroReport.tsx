"use client";

import Image from "next/image";
import type { AuditReport } from "@/lib/audit/types";
import { brand } from "@/lib/brand";
import { PremiumGauge } from "./PremiumGauge";
import { useReportExpand } from "./ReportExpandContext";

interface HeroReportProps {
  report: AuditReport;
  onNewAudit: () => void;
  onLogout?: () => void;
}

function cleanDomainName(domain: string) {
  const name = domain.replace(/^(www\.)/, "").split(".")[0];
  if (name.toLowerCase() === "tigribeach") return "Tigri Beach";
  return name
    .split(/[-_]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

const STRONGEST_SUBLABEL_MAP: Record<string, string> = {
  jsonLd: "explicit entity relationship schema",
  metaTags: "clean search engine index tags",
  semanticHtml: "structured landmark layout",
  altText: "descriptive alt tags for multimodal models",
  internalLinking: "interconnected pages and crawl paths",
  textToCode: "low HTML code overhead",
  mobileViewport: "responsive screen layouts",
  robotsTxt: "optimized crawler permissions",
  xmlSitemap: "comprehensive search discovery paths",
  llmsTxt: "optimized machine-readable summaries",
};

export function HeroReport({ report, onNewAudit, onLogout }: HeroReportProps) {
  const { meta, hero } = report;
  const { allExpanded, toggleAllExpanded } = useReportExpand();

  const strongestMetrics = [...report.technical]
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  const isTigri = meta.domain.toLowerCase().includes("tigribeach");
  const categoryLabel = isTigri
    ? "RESTAURANT · HOSPITALITY"
    : "SEO · GEO · AEO · TECHNICAL AUDIT";

  return (
    <header className="relative w-full bg-gradient-to-r from-[var(--navy-banner-from)] to-[var(--navy-banner-to)] text-white pt-12 pb-60">
      <div className="mx-auto max-w-[1400px] px-3">
        {/* Top bar: Category & Logo/Actions */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full border border-white/20 bg-white/5 px-3.5 py-1 text-[11px] font-semibold tracking-wider text-slate-200 uppercase">
              AI VISIBILITY AUDIT
            </span>
            <span className="text-[11px] font-semibold tracking-[0.2em] text-slate-400 uppercase">
              · {categoryLabel}
            </span>
          </div>

          <div className="flex flex-col items-end justify-start no-print">
            <div className="flex items-center h-12">
              <Image
                src={brand.logoSrc}
                alt={brand.name}
                height={44}
                width={Math.round(44 * brand.logoAspectRatio)}
                priority
                className="h-11 w-auto brightness-0 invert"
              />
            </div>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 mt-8">
          <div className="max-w-2xl">
            {/* Title */}
            <h1 className="font-serif text-4xl md:text-5xl font-bold tracking-tight text-white leading-[1.15]">
              Can AI Engines See <br />{" "}
              <span className="italic">{cleanDomainName(meta.domain)}</span>?
            </h1>

            {/* Description */}
            <p className="mt-4 text-slate-350 text-[15px] md:text-[16px] font-light leading-relaxed">
              A full-spectrum diagnostic of how ChatGPT, Claude, Perplexity,
              Gemini and AI Overviews read, trust, and cite {meta.domain}
            </p>
          </div>

          {/* Multi-Model AI Analysis inline block */}
          <div className="flex flex-col items-start gap-1.5 flex-shrink-0 mb-1 no-print">
            <span className="text-[10px] tracking-widest text-slate-400 uppercase font-semibold">
              Multi-Model AI Analysis Using
            </span>
            <div className="flex items-center gap-4 bg-white/5 border border-white/10 rounded-xl px-3.5 py-2">
              <Image
                src="/brand/claude.svg"
                alt="Claude"
                width={25}
                height={25}
                className="h-8 w-auto object-contain"
              />
              <Image
                src="/brand/chatgpt.svg"
                alt="ChatGPT"
                width={25}
                height={25}
                className="h-8 w-auto object-contain"
              />
              <Image
                src="/brand/grok.svg"
                alt="Grok"
                width={25}
                height={25}
                className="h-8 w-auto object-contain invert brightness-200"
              />
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="w-full h-px bg-white/10 my-8" />

        {/* Metadata columns */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-sm">
          <div>
            <div className="text-[10px] tracking-widest text-slate-400 uppercase font-semibold">
              SITE AUDITED
            </div>
            <a
              href={meta.auditedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1.5 block text-slate-200 hover:text-white underline decoration-white/30 truncate"
            >
              {meta.domain}
            </a>
          </div>
          <div>
            <div className="text-[10px] tracking-widest text-slate-400 uppercase font-semibold">
              AUDIT DATE
            </div>
            <div className="mt-1.5 text-slate-200">{meta.reportDate}</div>
          </div>
          <div>
            <div className="text-[10px] tracking-widest text-slate-400 uppercase font-semibold">
              METHODOLOGY
            </div>
            <div className="mt-1.5 text-slate-200">
              10-Signal Machine-Readability Framework
            </div>
          </div>
          <div>
            <div className="text-[10px] tracking-widest text-slate-400 uppercase font-semibold">
              PREPARED BY
            </div>
            <div className="mt-1.5 text-slate-200">{brand.name} </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2.5 mt-8 no-print">
          <button
            type="button"
            onClick={onNewAudit}
            className="rounded-lg border border-white/20 bg-white/5 hover:bg-white/15 text-white text-xs font-semibold px-4 py-2 transition-all cursor-pointer"
          >
            New audit
          </button>
          <button
            type="button"
            onClick={toggleAllExpanded}
            className="rounded-lg bg-white/15 hover:bg-white/25 text-white text-xs font-semibold px-4 py-2 transition-all cursor-pointer"
          >
            {allExpanded ? "Collapse all" : "Detailed report"}
          </button>
          {onLogout && (
            <button
              type="button"
              onClick={onLogout}
              className="rounded-lg border border-red-500/20 bg-red-500/10 hover:bg-red-500/20 text-red-305 text-xs font-semibold px-4 py-2 transition-all cursor-pointer"
            >
              Logout
            </button>
          )}
        </div>
      </div>

      {/* Floating Card with Gauges */}
      <div className="absolute left-0 right-0 -bottom-36 z-20">
        <div className="mx-auto max-w-[1400px] px-3">
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xl p-6 md:p-8 flex flex-col md:flex-row items-center gap-6 divide-y md:divide-y-0 md:divide-x divide-slate-100">
            {/* Left Column: Gauge & Verdict */}
            <div className="flex flex-col items-center text-center pb-6 md:pb-0 md:pr-6 flex-shrink-0 w-full md:w-auto">
              <div className="text-[10px] tracking-widest text-slate-400 uppercase font-bold mb-3">
                OVERALL AI VISIBILITY
              </div>
              <PremiumGauge score={hero.overall} />
              <p className="mt-4 text-sm text-[#07111F] font-semibold max-w-[200px] leading-relaxed">
                {hero.verdict}
              </p>
            </div>

            {/* Right Column: Executive Summary */}
            <div className="pt-6 md:pt-0 md:pl-8 flex-1 text-left w-full">
              <div className="text-sm leading-relaxed font-light text-slate-600">
                <b className="font-serif text-base block mb-2 font-bold text-[#07111F]">
                  Executive Summary
                </b>
                {hero.overall >= 70 ? (
                  <span>
                    The website demonstrates a solid structural and technical
                    foundation with clean semantic HTML layout hierarchies and
                    responsive viewport configurations. AI crawl engines are
                    able to parse basic body sections and index core metadata
                    smoothly. To elevate visibility further into top-tier
                    citation channels, prioritize extending JSON-LD entity
                    markup for services, publishing robots.txt allowing bot
                    agents, and building authoritative backlinks to reinforce
                    domain trust.
                  </span>
                ) : (
                  <span>
                    The audit has identified several critical deficiencies that
                    limit visibility across AI search engines. A thin schema
                    markup layer makes it difficult for LLM bots to extract rich
                    entity relationships, and sitemap/crawler access
                    restrictions limit crawl coverage. Additionally, on-page
                    content structures require optimization to replace vague
                    marketing statements with specific, citable facts, which are
                    crucial for answer extraction engines (AEO).
                  </span>
                )}
              </div>

              {/* Where This Audit Ranks Strongest */}
              <div className="mt-6 border-t border-slate-100 pt-5">
                <div className="text-[10px] tracking-widest text-slate-400 uppercase font-bold mb-3">
                  WHERE THIS AUDIT RANKS STRONGEST
                </div>
                <ul className="space-y-2 text-xs md:text-[13px]">
                  {strongestMetrics.map((card) => (
                    <li key={card.id} className="flex items-center gap-2">
                      <span className="text-blue-600 font-bold select-none">↑</span>
                      <span className="font-semibold text-[#07111F]">
                        {card.name} ({card.score})
                        <span className="text-slate-400 font-normal"> — {STRONGEST_SUBLABEL_MAP[card.id] || ""}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
