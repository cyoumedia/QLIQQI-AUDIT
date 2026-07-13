**The overall score (e.g. 68/100) is a composite average across 12 audited elements.**

How the Score is Calculated:

- **9 Technical & On-Page Elements**
    - JSON-LD richness
    - Meta tags
    - Semantic HTML
    - Alt text
    - Internal linking
    - Text-to-code ratio
    - Mobile viewport
    - Robots.txt (AI allow-list)
    - XML sitemap
- **3 AI-Visibility panel elements** (included in hero gauge)
    - GEO (Generative Engine Optimization)
    - AEO (Answer Engine Optimization)
    - Structured Content

**SEO in the AI-Visibility panel (display only — not in hero overall):**

- SEO appears as the **first cell** in the Priority Panel (SEO → GEO → AEO → Structured Content).
- SEO cell score = **50% max(AI SEO from Claude/Grok/OpenAI) + 50% PSI SEO aggregate**.
- SEO contributes to the **AI composite footer** (`SEO·GEO·AEO·Structured`) but **does not** count toward the hero overall gauge.

**Calculation Method:**

- Each of the **12 hero elements** receives an individual score from 0 to 100.
- The **overall score** is the **simple average** of those 12 scores, with **`Math.round`** applied.
- The **AI composite footer** averages all **4** panel pillars (SEO, GEO, AEO, Structured Content).

**Example:**

**Technical (9 elements):** 35 + 82 + 85 + 75 + 80 + 78 + 100 + 45 + 50 = 630 → average ≈ 70

**AI Panel — hero contributors (3):** GEO 62 + AEO 75 + Structured 78 = 215 → average ≈ 71.7

**Combined (12 elements):** 845 ÷ 12 = 70.4 → **rounded to 70** in the hero gauge.

*(SEO panel cell e.g. 68 is shown separately and in the 4-pillar composite footer only.)*

**AI provider merge (v1):**

- Claude, Grok, and OpenAI are polled for GEO, AEO, Structured, and raw AI SEO.
- **Per metric:** use the **highest** provider score; display the winning provider name under each cell.

**Technical card scoring:**

- **Rules are the score** for verified/estimated checks.
- **AI provides narrative** (finding + fix) and optional **±5 nudge** for inferred/unverified elements only.

**Implementation:** All formulas live in [`lib/audit/scorer.ts`](lib/audit/scorer.ts).

Quick Rule of Thumb:

- 85+ → Excellent AI-first site
- 75–84 → Very good
- 65–74 → Solid foundation but needs work
- Below 60 → Major technical issues
