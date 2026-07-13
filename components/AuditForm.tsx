"use client";

import Image from "next/image";
import { brand } from "@/lib/brand";

interface AuditFormProps {
  url: string;
  onUrlChange: (url: string) => void;
  onSubmit: () => void;
  onSample: () => void;
  disabled?: boolean;
  onLogout?: () => void;
}

export function AuditForm({
  url,
  onUrlChange,
  onSubmit,
  onSample,
  disabled,
  onLogout,
}: AuditFormProps) {
  return (
    <div className="w-full min-h-screen bg-gradient-to-br from-[#0a1c30] to-[#0f2840] text-white flex flex-col justify-between selection:bg-[#1D538C]/50 selection:text-white">
      
      {/* Top Navbar */}
      <header className="w-full max-w-[1400px] mx-auto px-4 md:px-8 py-6 flex items-center justify-between border-b border-white/5">
        <div className="flex items-center h-10">
          <Image
            src={brand.logoSrc}
            alt={brand.name}
            height={38}
            width={Math.round(38 * brand.logoAspectRatio)}
            priority
            className="h-9 w-auto brightness-0 invert"
          />
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onSample}
            className="text-xs font-semibold text-slate-300 hover:text-white transition-colors cursor-pointer border border-white/10 hover:border-white/20 bg-white/5 px-4 py-2 rounded-xl"
          >
            Sample Report
          </button>
          {onLogout && (
            <button
              type="button"
              onClick={onLogout}
              className="text-xs font-semibold text-red-450 hover:text-red-400 transition-colors cursor-pointer border border-red-500/20 bg-red-500/10 px-4 py-2 rounded-xl"
            >
              Logout
            </button>
          )}
        </div>
      </header>

      {/* Main Grid Content */}
      <main className="flex-1 w-full max-w-[1400px] mx-auto px-4 md:px-8 py-12 md:py-20 flex items-center">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center w-full">
          
          {/* Left Column: Form & Call to Action */}
          <div className="lg:col-span-7 flex flex-col space-y-6 md:space-y-8">
            <div className="space-y-3">
              <span className="inline-flex px-3 py-1 rounded-full border border-white/10 bg-white/5 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
                AI VISIBILITY PLATFORM
              </span>
              <h1 className="font-serif text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-white leading-[1.1]">
                Can AI Search Engines <br className="hidden md:inline" />
                <span className="italic">Read & Cite </span>
                Your Site?
              </h1>
              <p className="max-w-xl text-slate-300 text-sm md:text-base font-light leading-relaxed">
                Traditional crawlers index links. Generative models (Gemini, ChatGPT, Claude) synthesize facts. Audits how machine minds parse, trust, and rank your brand.
              </p>
            </div>

            {/* Audit Input Form */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                onSubmit();
              }}
              className="w-full max-w-2xl bg-white/5 border border-white/10 rounded-2xl p-2.5 backdrop-blur-md shadow-2xl flex flex-col sm:flex-row gap-2.5"
            >
              <div className="flex-1 relative flex items-center">
                <span className="absolute left-4 text-slate-500 font-mono text-sm pointer-events-none select-none">
                  url:
                </span>
                <input
                  type="text"
                  value={url}
                  onChange={(e) => onUrlChange(e.target.value)}
                  placeholder="https://yourwebsite.com"
                  className="w-full rounded-xl bg-transparent pl-12 pr-4 py-3 text-white placeholder-slate-500 text-sm outline-none border border-transparent focus:border-[#1d538c]/20 transition-all font-mono"
                  disabled={disabled}
                  autoComplete="off"
                  autoFocus
                />
              </div>
              <button
                type="submit"
                disabled={disabled || !url.trim()}
                className="rounded-xl bg-white hover:bg-slate-100 px-7 py-3 text-xs tracking-wider uppercase font-bold text-[#07111F] transition-all duration-200 shadow-md disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex-shrink-0"
              >
                Launch Audit
              </button>
            </form>

            {/* Bottom Actions & Taglines */}
            <div className="pt-2 flex flex-col sm:flex-row sm:items-center gap-4 text-xs text-slate-400 font-light divide-y sm:divide-y-0 sm:divide-x divide-white/15">
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                <span>Full crawl · PageSpeed · LLM consensus</span>
              </div>
              <div className="sm:pl-4 pt-3 sm:pt-0">
                Typically 2–10 mins ·{" "}
                <button
                  type="button"
                  onClick={onSample}
                  className="font-semibold text-blue-450 hover:text-blue-400 transition-colors cursor-pointer underline decoration-blue-450/40"
                >
                  View Sample Report
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Onboarding Blueprint Preview Card */}
          <div className="lg:col-span-5">
            <div className="bg-white/5 border border-white/10 backdrop-blur-md rounded-3xl p-6 md:p-8 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none -mr-32 -mt-32" />
              
              <div className="relative space-y-6">
                <div>
                  <span className="text-[10px] font-bold tracking-[0.2em] text-blue-400 uppercase block mb-1">
                    SYSTEM ONBOARDING
                  </span>
                  <h3 className="font-serif text-lg md:text-xl font-bold text-white">
                    Core Audit Blueprint
                  </h3>
                  <p className="text-xs text-slate-400 font-light mt-1">
                    A four-stage verification mapping your website&apos;s indexing trust inside LLM neural nodes.
                  </p>
                </div>

                {/* Steps */}
                <div className="space-y-4 pt-2">
                  
                  {/* Step 1 */}
                  <div className="flex items-start gap-4">
                    <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center font-mono text-xs font-bold text-blue-400 flex-shrink-0 mt-0.5">
                      01
                    </div>
                    <div>
                      <h4 className="text-xs md:text-sm font-semibold text-white tracking-tight">
                        Resource Discovery
                      </h4>
                      <p className="text-[11px] md:text-xs text-slate-400 font-light mt-0.5">
                        Crawls page sitemaps, robots rules, and evaluates domain canonical trees.
                      </p>
                    </div>
                  </div>

                  {/* Step 2 */}
                  <div className="flex items-start gap-4">
                    <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center font-mono text-xs font-bold text-blue-400 flex-shrink-0 mt-0.5">
                      02
                    </div>
                    <div>
                      <h4 className="text-xs md:text-sm font-semibold text-white tracking-tight">
                        Core UX & Performance
                      </h4>
                      <p className="text-[11px] md:text-xs text-slate-400 font-light mt-0.5">
                        Tests mobile responsiveness and runs PageSpeed Insights accessibility diagnostics.
                      </p>
                    </div>
                  </div>

                  {/* Step 3 */}
                  <div className="flex items-start gap-4">
                    <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center font-mono text-xs font-bold text-blue-400 flex-shrink-0 mt-0.5">
                      03
                    </div>
                    <div>
                      <h4 className="text-xs md:text-sm font-semibold text-white tracking-tight">
                        AI Crawler Permissions
                      </h4>
                      <p className="text-[11px] md:text-xs text-slate-400 font-light mt-0.5">
                        Inspects crawler visibility restrictions for GPTBot, ClaudeBot, and BingBot.
                      </p>
                    </div>
                  </div>

                  {/* Step 4 */}
                  <div className="flex items-start gap-4">
                    <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center font-mono text-xs font-bold text-blue-400 flex-shrink-0 mt-0.5">
                      04
                    </div>
                    <div>
                      <h4 className="text-xs md:text-sm font-semibold text-white tracking-tight">
                        Multi-Model AI Consensuses
                      </h4>
                      <p className="text-[11px] md:text-xs text-slate-400 font-light mt-0.5">
                        Queries Claude, GPT, and Grok to analyze content semantic richness and factual citations.
                      </p>
                    </div>
                  </div>

                </div>
              </div>
            </div>
          </div>

        </div>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-[1400px] mx-auto px-4 md:px-8 py-6 text-center border-t border-white/5 text-[10px] md:text-xs text-slate-500 font-light">
        © {new Date().getFullYear()} CYouMedia. All rights reserved. Designed for agentic web discovery.
      </footer>
    </div>
  );
}
