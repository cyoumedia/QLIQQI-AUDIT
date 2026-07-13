# Pre-launch Checklist

Required before public URL / production marketing.

- [ ] **Demo report mode** — “View sample report” on homepage loads ÅkersBärgarn fixture without API keys
- [ ] **Vercel Pro** — confirm `maxDuration` (300s+) sufficient for 200+ page discovery + 3 AI on staging
- [ ] **Large-site smoke test** — 100+ sitemap URLs: discovery completes, AI uses `AI_SUMMARY_PAGE_LIMIT`, hero shows both counts
- [ ] **Partial provider failure** — disable one API key; audit completes with toast + `providersFailed` in report meta
- [ ] **PSI rate limit** — 8-sample audit respects `PSI_CONCURRENCY=2`
- [ ] **SSRF + rate limit** — spot-check `127.0.0.1` and `169.254.169.254` blocked on staging
- [ ] **Print + JSON export** — `schemaVersion` present; form/diagnostics hidden in print preview
