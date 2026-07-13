# QLIQQI URL Audit

Enterprise one-page web app for AI-Visibility and SEO auditing. Built with Next.js 15, TypeScript, and Tailwind CSS.

## Features

- Full-site crawl (sitemap → internal-link fallback)
- `robots.txt`, `llms.txt`, and sitemap verification
- Google PageSpeed Insights (sampled site-wide)
- Claude, Grok, and OpenAI parallel analysis
- Live System Diagnostics progress UI
- QLIQQI light brand theme
- Sample report demo mode (no API keys required)

## Setup

```bash
npm install
cp .env.example .env.local
# Fill in API keys in .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment variables

See [`.env.example`](.env.example). All keys are **server-side only** — never use `NEXT_PUBLIC_*` for secrets.

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | For live AI | Claude analysis |
| `XAI_API_KEY` | For live AI | Grok analysis |
| `OPENAI_API_KEY` | For live AI | OpenAI analysis |
| `GOOGLE_PAGESPEED_API_KEY` | Optional | Raises PSI quota |

## Deployment (Vercel)

- Route `app/api/audit/stream/route.ts` sets `maxDuration = 300` (use Vercel Pro for large sites).
- Hobby tier (60s) may timeout on large crawls + 3 AI providers.
- See [`deployment.md`](deployment.md) for scaling notes.

## Scoring

All formulas documented in [`Overall Score Calc.md`](Overall%20Score%20Calc.md) and implemented in [`lib/audit/scorer.ts`](lib/audit/scorer.ts).

## Pre-launch checklist

See plan pre-launch section in [`deployment.md`](deployment.md).
# QLIQQI-AUDIT
