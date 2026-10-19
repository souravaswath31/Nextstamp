# NextStamp launch plan: 19 Oct 2026 to public launch (target Tue 12 Jan 2027)

Written 19 Oct 2026 from four independent research passes (competitors, a code audit, growth, visa-data trust). Evidence
labels matter here: **[verified]** means checked against a primary page or the code; **[reported]** means a secondary
source; **[estimate]** is judgement. Update the status column as work lands.

## 1. What the research changed

1. **The held-document cascade is a feature, not a moat.** VisaHacks.in (India only, free), Visa Free Nomads and
   VisaRadar already stack US/UK/Schengen visas on a passport **[reported]**. Do not say "first" or "only" anywhere. What
   is still defensible: a source and a "checked on" date on every rule, 8 passports (VisaHacks has one), visible source
   conflicts, and the result feeding a trip plan, expenses and group decisions.
2. **The visa lookup alone will not sell.** Free competitors cover it. The paid hook has to be what they lack: saved
   trips, group tools, expiry and rule-change alerts.
3. **$5 once does not fund the upkeep.** Payment fees take about 9 to 15% of $5, one Stripe dispute costs $15, and visa
   rules decay (33 rows lapse on 31 Dec 2026 alone) **[reported/computed]**. See decision D1.
4. **Our own data has structural gaps, not many outright errors.** All 850 rules are dated 17 to 19 Oct, so the date says
   nothing yet. 36% of rows carry their own "confirm/unclear" wording. The cascade models only 9 held-document countries
   and leaves out Schengen, the most common visa Indian travellers hold. The USA is not a destination at all.
5. **Escape Hatch is a US weekend-trip loop, not the funnel for the visa product.** Its realistic viral coefficient is
   about 0.15 to 0.3 **[estimate]**. Keep it as free reach and affiliate income, with a soft "plan this trip" upsell.
6. **Search is the main channel, and it is slow.** Expect a few thousand organic visits a month by month six, not at
   launch **[estimate]**. Publish in stages and only index pages that have a verified rule.

## 2. Decisions that are yours (I will build either way once you choose)

| # | Decision | My recommendation |
|---|---|---|
| D1 | Pricing shape | Keep a $5 unlock but include 12 months of rule-change alerts, with an optional annual renewal after that. A bare lifetime $5 only works if the unlock is described as a snapshot. |
| D2 | Beta users (`PAID_GRANDFATHER_BEFORE`) | Set a date before keys go live. Unset means every beta user instantly loses trips, documents and cascade results. |
| D3 | Free tier | Let free users create one trip and see one cascade result, so they meet the product before the paywall. |
| D4 | Saudi Arabia routes | Still withheld (UK and Canada advise against travel). Your call. |
| D5 | Custom domain | Buy it now. Search indexing takes weeks and canonicals, Stripe returns and the sitemap all depend on it. |
| D6 | Support and legal contact | Need a real monitored address and a lawyer review of terms, privacy and refunds. |
| D7 | Refund window and tax | Needed before payments go on (suggest 14 days and Stripe Tax; accountant for VAT/GST). |

## 3. Workstreams

Owner: **Me** = I do it; **You** = needs your account, money or judgement. Status: todo / doing / done.

### A. Security and reliability (code audit)
| Item | Owner | Status |
|---|---|---|
| Held-document delete had no auth check; fixed with ownership scope | Me | done (PR 19) |
| Open redirect on sign-in callback | Me | done (PR 19) |
| Error pages, checkout failure message, API timeouts, baseline security headers | Me | done (PR 19) |
| Row Level Security: audit flagged it, **checked live: enabled on all 25 tables** | Me | done, no action |
| DB indexes on hot columns; revoke anon execute on `rls_auto_enable` | Me | done (applied live) |
| Custom SMTP for magic links (Supabase built-in is about 2 emails per hour) | You (account) + Me (wiring) | todo, **blocker** |
| Error monitoring (Sentry or Vercel Observability), uptime check, Stripe webhook failure alerts | Me + You (accounts) | todo, blocker |
| Account deletion and data export (GDPR/CCPA) | Me; needs Supabase service-role key from you | todo, blocker |
| Distributed rate limiting (limiters are in memory), room-code oracle on Escape GET | Me | todo |
| Cap or paywall trip-import analysis (free sign-ups can run up the Anthropic bill) | Me, after D1 | todo |
| Input validation on server actions (trip days, expenses, held-document dates, Escape config) | Me | todo |
| Invite links: reset, leave trip, hide collaborator emails | Me | todo |
| Content-Security-Policy in report-only mode first | Me | todo |
| CI (GitHub Actions: tsc, tests, build) and a staging database; E2E currently writes to production | Me | todo |
| Authz regression tests (second user cannot touch another's trip/document/fund) | Me | todo |

### B. Performance and SEO
| Item | Owner | Status |
|---|---|---|
| Root layout reads cookies, so every page is dynamic and each visit hits Auth plus Postgres. Move the session read to a client island, then ISR the public pages | Me | todo, **launch-traffic blocker** |
| `next/image` and sized, compressed cover images (covers up to 435 KB as raw `<img>`) | Me | todo |
| Canonicals, per-page Open Graph images, BreadcrumbList JSON-LD; set `NEXT_PUBLIC_SITE_URL` on the custom domain | Me | todo |
| Lazy-load MapLibre | Me | todo |
| Contrast: about 181 text usages below AA; skip link; form labels; `role=alert` on errors | Me | todo |

### C. Visa data (trust is the product)
| Item | Owner | Status |
|---|---|---|
| ~19 rows still said ETIAS was "expected/scheduled for the last quarter of 2026"; the EU portal (checked 19 Oct) gives no date. Rewritten; remaining mentions say the target was dropped | Me | done (PR 20) |
| India to UAE via a US visa: official ICP/MOFA text says a valid residence permit, not a tourist visa. Resolve from the primary page or downgrade | Me | todo, week 1 |
| Add missing cascade rows: India to Turkey (UK/Ireland/Schengen), Mexico (UK/Japan), Costa Rica (Canada) | Me | todo, week 1 |
| `VisaBadge` hard-coded "via your US visa" for every cascade; now names the document used | Me | done (PR 20) |
| Replace `last_verified_date` with `last_checked`, `last_changed`, `evidence`, plus `valid_until` for scheduled expiries; fix the staleness wording | Me | todo, weeks 1-2 |
| Shared regimes table (ETIAS, EES, UK ETA) so one edit updates about 240 rows | Me | todo |
| Add USA as a destination for the 7 other passports (CBP/USCIS/Federal Register; travel.state.gov blocks us) | Me | todo, weeks 3-5 |
| Replace 70 non-primary sources (embassy/tourism sites), worst first: Thailand, Maldives, Philippines, Panama, Vietnam, Egypt | Me | todo, weeks 3-5 |
| Model Schengen as a held document | Me | todo, decide in week 3 |
| Re-verify all 57 cascade rows by hand against primary text | Me | todo, weeks 3-5 |
| Source-change monitor: weekly GitHub Action, page hash and diff, LLM triage into an issue, human review, never auto-publish; FCDO API as a free change signal. About $2 a month plus 1 to 2 hours a week of your review time | Me | todo, weeks 1-2 |
| Confidence chip, age-based wording, "report an error" button and public change log | Me | todo, weeks 6-7 |
| **Dated cliffs:** China, Korea K-ETA, Malaysia, Dominican Republic, Bolivia, Mongolia lapse 31 Dec 2026; none renewed as of 19 Oct | Me watches daily from 1 Nov | watch |
| Fix CLAUDE.md "154 rules" (real count 850) | Me | todo |

### D. Product
| Item | Owner | Status |
|---|---|---|
| Onboarding takes any passport but only 8 are covered. Add a supported-passport picker or an upfront "we cover these 8, join the list for yours" | Me | todo, week 1 |
| First 60 seconds: guided "check your first destination" step; free tier per D3 | Me | todo |
| Positioning copy: drop "first/only"; lead with "official source and date on every rule" | Me | todo |
| Waitlists promise email but send none; send confirmations once SMTP exists | Me | todo |
| Remove "(draft)" labels; add contact page | Me + You (D6) | todo |
| Rule-change alerts attached to a saved trip (semi-automated) | Me | after launch if time is short |

### E. Legal and payments
| Item | Owner | Status |
|---|---|---|
| Privacy policy says "no analytics" but Vercel Analytics is loaded; it also omits Stripe, Google sign-in, passport expiry, Escape Hatch data and retention | Me drafts; You + lawyer approve | todo, blocker |
| Terms need governing law, liability limit, age limit, refund wording | You + lawyer | todo |
| Stripe Tax, refund policy, receipts, dispute-won handling, double-payment guard | Me + You (D7) | todo |
| Revoke the old Vercel token; restrict the MapTiler key to your domain | You | todo |

### F. Growth
| Item | Owner | Status |
|---|---|---|
| Custom domain, Search Console, Bing, privacy-friendly analytics (Plausible about $9 a month, or free options) | You (accounts) + Me | todo, week 1 |
| About 50 cascade pages ("Indian passport + US visa: where you can go") and hubs `/visa/from/[passport]`, `/visa/to/[country]`. Show the official wording per row and flag source conflicts. Stage about 150 pair pages first; index only rows with a verified source | Me | weeks 2-6 |
| Add Philippines, Pakistan, Nigeria passports; then resident-permit document types (UK, Schengen, UAE) | Me | weeks 4-9 |
| "We checked N blog claims against official sources" report (link and press magnet, doubles as row QA) | Me | weeks 5-9 |
| Beta cohort of 50 to 200 from student, diaspora and community groups; collect real testimonials only | You (outreach), Me (tooling) | weeks 6-10 |
| Escape Hatch: rich share preview, MLK weekend push (16-18 Jan), soft "plan this trip" CTA | Me | weeks 8-11 |
| Show HN (signup-free checker), community answers with disclosure | You post, Me drafts | launch week +1 |
| Gemini cover images for about 144 new itineraries | You generate; Me prompts and wiring | whenever you say |

## 4. Calendar

| Week of | Focus |
|---|---|
| 19 Oct | PR 19 merged. This plan. Data: ETIAS rows, UAE, Turkey/Mexico/Costa Rica, badge label. Start monitor. You: decisions D1-D7, buy domain, SMTP and monitoring accounts. |
| 26 Oct | SMTP and monitoring wired. Account deletion and export. Privacy policy rewrite for review. Supported-passport onboarding. |
| 2 Nov | Layout/ISR refactor. Watch China/Korea renewals. Data model fields (`last_checked`, `valid_until`, regimes). |
| 9 Nov | USA destination rows. Replace weak sources (batch 1). First staged pair pages and cascade pages. |
| 16 Nov | Replace weak sources (batch 2). Cascade re-verification. CI and staging. Rate limiting and validation. |
| 23 Nov | Philippines/Pakistan/Nigeria data. Confidence chip, report-an-error. Recruit beta. |
| 30 Nov | Beta starts. Image optimisation, contrast pass, CSP in report-only. |
| 7 Dec | Beta fixes. Payments on in test mode end to end. Lawyer feedback applied. |
| 14 Dec | **Data freeze (15 Dec):** full re-verify of the top destinations across all 8 passports. |
| 21 Dec | Quiet period: draft the 2027 rule-changes report, Show HN post. Final security pass. |
| 28 Dec | Apply 31 Dec/1 Jan changes using `valid_until`; ship changelog. |
| 4 Jan | Re-check everything that changed on 1 Jan. Waitlist email in cohorts. Dry run of payments live. |
| **12 Jan** | **Public launch.** Report and press outreach. |
| 18-25 Jan | Show HN, Escape Hatch MLK push, Search Console review (prune what did not index). |

Why 12 Jan and not the first week: the 1 Jan lapses (K-ETA, China, Malaysia) need a few days to settle, and the launch should
not be the first time a lapsing rule is handled.

## 5. Risks

- **A publicly wrong sourced rule** hurts the one thing we sell. Mitigation: monitor, confidence labels, report-an-error, never auto-publish.
- **Free competitors** cap what a lookup is worth. Mitigation: paid hook is saved trips, group tools and alerts (D1, D3).
- **Platform planners** (Google AI Mode, ChatGPT apps, Expedia/Layla) commoditise itineraries. Do not compete on itinerary count.
- **AI answer boxes** cut clicks on pure lookup queries. Personal cascade results and alerts are what they cannot do.
- **Solo upkeep:** about 1 to 2 hours a week of diff review after launch. That is the real cost of the honesty promise.
- **Google "scaled content" policy:** staged rollout, one canonical URL per pair, only pages with a verified rule, hub pages for browsing.

## 6. Not doing before launch

Booking-email import, direct booking, Chinese/Turkish/Vietnamese passports and languages, a native app. Revisit after launch data.
