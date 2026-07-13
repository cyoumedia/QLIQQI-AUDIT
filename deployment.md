# QLIQQI URL Audit — Deployment & Operations Notes

Reference for hosting, scaling, monetization, and future pipeline optimizations.

---

## Hosting (v1)

- **Platform:** Vercel (Next.js App Router, SSE audit stream).
- **Crawl budget (v1):** No hard cap initially — full sitemap / internal-link discovery runs to completion.
- **Future monetization:** Time-based or token-based crawl budgets for free tier; paid tiers by page count or token usage. UI pattern: toast warning — *“Audited 142 of 380 pages — budget reached.”*
- **Env vars:** Server-side only (never `NEXT_PUBLIC_*` for API keys). See `.env.example`.

### Vercel timeout considerations

Large sites (500+ pages) + PSI sampling + 3 AI providers may approach function limits. Mitigations in v1:

- Stream SSE progress throughout the run.
- Parallel page fetch with concurrency limit (`CRAWL_CONCURRENCY`, default 8).
- Batch/summarize page content before AI prompts (`AI_SUMMARY_PAGE_LIMIT`, default 50).
- PSI sampled across representative pages, not every URL (`PSI_SAMPLE_SIZE`, `PSI_CONCURRENCY`).

If timeouts persist at scale, options documented here for phase 2:

1. **Vercel Pro** extended duration.
2. **Background worker** (Inngest, QStash, Trigger.dev) with ephemeral job ID + polling.
3. **Long-running Node container** (Railway, Fly.io, Azure Container Apps) for unlimited crawl duration.

---

## Security (required)

| Control | Implementation |
|---------|----------------|
| SSRF protection | Block private IP ranges, link-local, metadata endpoints; validate redirects |
| URL validation | HTTPS/HTTP only; reject `file://`, malformed hosts |
| Rate limiting | Per-IP/session audit throttle (e.g. 3 audits / hour on free tier) |
| Secret handling | API keys in `.env.local` only; `.gitignore` excludes secrets |
| Abort support | `AbortController` on crawl + SSE so users can cancel in-flight audits |

---

## AI provider strategy

### v1 (current)

- Poll **Claude, Grok, and OpenAI** in parallel for every audit.
- **Per metric** (SEO, GEO, AEO, Structured): take **highest score** across providers.
- Display **winning provider** under each AI panel cell.
- SEO panel cell: `50% max(AI SEO) + 50% PSI SEO aggregate`.
- Narrative (finding + fix) from the provider that supplied the winning score.

### Future optimizations (not v1)

Documented for when cost/latency becomes a concern:

1. **Map-reduce AI** — Summarize pages in batches locally, single Claude synthesis pass; Grok/OpenAI only on low-confidence flags.
2. **Conditional second provider** — Run Grok/OpenAI only when Claude confidence &lt; threshold or scores disagree by &gt;15 points.
3. **Score range display** — Show min–max across providers when spread &gt;10; highlight agent crawl failures separately.
4. **Provider fallback** — If one agent fails to reach URL, exclude from max() and note in UI.

---

## Crawl pipeline (v1)

1. **robots.txt** — Fetch and parse; AI bot allow-list rules; respect `Disallow` for crawler.
2. **llms.txt** — Fetch if present; score boost + finding in GEO/AEO narrative.
3. **sitemap.xml** — Parse all locs; handle nested sitemap indexes with recursion depth guard + URL dedupe + trailing-slash normalization.
4. **Fallback** — BFS internal links from seed URL (same origin) when no sitemap.
5. **Raw HTML fetch** — `fetch` + `cheerio` per page; honest **Unverified** labeling when content is thin or blocked.
6. **No Playwright in v1** — SPAs may score as thin content; note in verification section.

---

## Lighthouse / PSI (v1)

- **Not homepage-only** — Sample PSI across **N representative pages** from the full crawl (homepage + templates with most internal links + random sample).
- Configurable via `PSI_SAMPLE_SIZE` (default e.g. 5–10 depending on site size).
- Aggregate category scores (mean per category) for Lighthouse panel gauges.
- PSI SEO aggregate feeds SEO panel blend (50% weight).
- Surface **top 3 opportunities** per category from PSI audit details (LCP, CLS, etc.).
- Label UI: *“Google PageSpeed Insights — {N} pages sampled, mobile strategy”*.

---

## Scoring

All formulas live in [`lib/audit/scorer.ts`](lib/audit/scorer.ts).

| Metric | Formula |
|--------|---------|
| Hero overall | `round(avg(9 technical + GEO + AEO + Structured))` — **12 elements, SEO excluded** |
| AI composite footer | `round(avg(SEO, GEO, AEO, Structured))` — **4 pillars** |
| SEO cell | `round(0.5 × max(AI SEO) + 0.5 × PSI SEO)` |
| GEO / AEO / Structured | `max(claude, grok, openai)` per metric |
| Technical cards | Rules-first; AI narrative + optional ±5 nudge for inferred/unverified only |

---

## UX requirements (v1)

- **Cancel audit** — AbortController + server abort during crawl/PSI/AI.
- **New audit** — Clear report state, return to URL input without full page reload.
- **SSE reconnect** — On disconnect, toast + “Retry audit” CTA.
- **Duration estimate** — Before start: *“Typically 2–10 min depending on site size.”*
- **Pages list** — Hero shows count + expandable list; truncate inline display for large sites.
- **Crawl budget toasts** — When budget feature enabled, warn at 80% and on cap.
- **Per-page findings appendix** — Collapsible section, collapsed by default.
- **Logo** — QLIQQI wordmark in hero (input + report) and footer.

---

## Out of scope (pre-launch backlog)

- Sample / demo report mode (add before public launch).
- Audit history / shareable report URLs (requires DB).
- Auth / multi-tenant billing.
- Playwright headless for JS-rendered SPAs.
- PDF server-side generation (print CSS only for v1).

---

## File checklist

```
.env.example          # placeholder keys, no secrets
.gitignore            # .env*, node_modules, .vercel, etc.
deployment.md         # this file
lib/audit/scorer.ts   # scoring formulas
Overall Score Calc.md # hero gauge documentation
```
