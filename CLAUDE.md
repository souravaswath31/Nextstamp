# NextStamp — Project Brief & Development Guide

This file is written for whoever (or whatever) picks up development next — a fresh
Claude Code session, another AI coding tool, or a human developer with zero prior context.
Read this fully before making changes. It captures not just *what* exists, but *why* —
several early mistakes shaped rules that are easy to accidentally violate if you don't know
the history.

## What this is

A trip-planning tool. The core differentiator: it checks visa status against a user's
**actual held documents** (not just their passport) and implements a cascade — e.g., an
Indian passport plus a valid US visa unlocks visa-free or on-arrival access to 25+ countries
that neither document unlocks alone. Everything else (state guides, itineraries, packing
lists, budgets) exists to make this a complete trip-planning tool, not just a visa checker.

**Business model (not yet built):** eventually a $5 one-time purchase unlocking
personalization (visa status, cascade, saving trips) on top of a free browsable content
library. Payment is intentionally not built yet — see Roadmap.

**Current stage:** a real, deployed, multi-user product. Supabase Auth (email magic link)
replaced the single hardcoded user; Postgres (hosted on Supabase) replaced local SQLite;
the app is live at **https://nextstamp-app.vercel.app**, deployed on Vercel, connected to
`github.com/souravaswath31/Nextstamp`. Content is no longer static-and-done — two automated
research pipelines (see "Content pipeline engines" below) exist to keep growing it.

## The one rule that matters most: never fabricate a fact

This project's differentiator against "just ask an AI chatbot" is that everything is sourced,
dated, and verified — not generated. This shaped real decisions, not just talking points:

- Every visa rule has a `sourceUrl` and `lastVerifiedDate`. The UI surfaces staleness rather
  than hiding it.
- `scripts/generate_itinerary_draft.py` (see below) **deliberately does not compute
  geographic ordering or drive times** — there's no coordinate data to base that on, and a
  plausible-looking invented route would be exactly the kind of fabrication this project
  avoids everywhere else. Running it raw on Montana produced a draft that put Yellowstone and
  Glacier National Park (400 miles apart) in the same week-long trip. It was caught by a
  human/geographic review pass, not by the script — because the script is designed to hand
  off that judgment, not fake it.
- The content pipeline engines (below) run with **no human geographic review gate** by
  explicit project-owner decision — the research step itself (real web search per fact) is
  the only verification that happens before content ships. This is a known, accepted risk:
  the automated validators check structure and sourcing *presence*, not factual accuracy.
  A research agent that gets a drive time wrong will ship that mistake. If you're asked to
  tighten this up, the lever is the research prompt's rigor, not the validator.
- If you add new content by hand (not through the pipeline), hold it to the same standard:
  real search, real sources, and if you can't verify something (a drive time, a distance, a
  current policy), leave it out or flag it rather than guess.

## Tech stack

- **Next.js 14, App Router, TypeScript, Tailwind CSS**
- **Prisma ORM + Postgres**, hosted on **Supabase**. `DATABASE_URL` (pooled, port 6543) is
  the runtime connection; `DIRECT_URL` (unpooled, port 5432) is what Prisma uses for
  `db push`/migrations. Both live in `.env` (gitignored) — see Supabase dashboard → Connect →
  ORMs → Prisma for the exact connection strings if you need to regenerate them.
- **Supabase Auth** — email magic link only (no OAuth providers yet, no password auth).
  `src/utils/supabase/{client,server,middleware}.ts` are the three client factories;
  `src/middleware.ts` refreshes the session cookie on every request.
- **Deployed on Vercel**, project `sourav-82c9/nextstamp-app`, aliased to
  `nextstamp-app.vercel.app`. GitHub-connected, so a push to `main` auto-deploys (a manual
  `vercel deploy --prod` also works and was the primary deploy path used so far).
- **lucide-react** for icons (added during the Apple-style redesign).

## Getting started

```bash
npm install
# Add .env with DATABASE_URL, DIRECT_URL, NEXT_PUBLIC_SUPABASE_URL,
# NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY — see Supabase dashboard for a project's values.
npm run db:push   # syncs schema.prisma to the Postgres database
npm run seed      # loads data/*.json into the database — see prisma/seed.ts
npm run dev       # http://localhost:3000 — you'll land on /login (real auth, not a stub)
```

`npm run seed` is **safe to rerun against production** in the sense that it never touches
User/HeldDocument/UserTrip — but it gets there by deleting and recreating all global
content, and a mid-run connection drop leaves the site with empty tables until a rerun
finishes (this has happened twice; see the incident section). Prefer the targeted seeders
when you only changed part of the content:

```bash
npm run seed              # everything — the destructive full refresh
npm run seed:countries    # country guides only, one transaction per country
npm run seed:countries Japan
npm run seed:coords       # just the geocoded place coordinates, updates in place
```

There's also `npm run build` — always run this (not just `dev`) before considering a change
done. Several real bugs in this project's history only surfaced at build time (TypeScript
strictness catching schema/type mismatches that `dev` mode didn't flag immediately).

**Testing auth locally without a real inbox:** Supabase's admin API can generate a magic
link without sending an email — `POST /auth/v1/admin/generate_link` with the project's
secret key, `{"type":"magiclink","email":"..."}`. The `action_link` it returns, when
visited, redirects with tokens in the URL fragment (implicit flow, not the app's real PKCE
flow). To actually establish a session locally, past sessions used a **temporary** route
handler (`src/app/api/dev-test-login/route.ts`, POST `{access_token, refresh_token}` →
`supabase.auth.setSession()`) — create it, use it, **delete it before deploying**. Don't
leave this route in the deployed app.

## Repository structure

```
prisma/schema.prisma        Data model (see below)
prisma/seed.ts               Seeds global content from data/*.json — never touches users
data/itineraries-seed.json   114 itineraries: day-by-day, food_culture (international only), related_states (domestic only)
data/state-guides-seed.json  50 states × ~17 places each (amazing/common/hidden/food_culture)
data/visa-rules-seed.json    154 rules: 8 passports × up to 18 destinations each
data/country-facts-seed.json Country guides: entry rules, health, money, power, emergency numbers, transit, connectivity, 12-month climate, phrasebook
scripts/generate_itinerary_draft.py   Draft generator for a state's places (see below)
scripts/validate_itineraries.py       Content pipeline gate — see "Content pipeline engines"
scripts/validate_visa_rules.py        Content pipeline gate — see "Content pipeline engines"
scripts/validate_country_facts.py     Content pipeline gate for country guides
src/lib/visa.ts               Visa status resolution + cascade logic (the core differentiator)
src/lib/readiness.ts          Entry-readiness engine — the trip-shaped layer on top of visa.ts
src/lib/countryFacts.ts       Read side of the country-guide data set (+ parsers for its packed string columns)
src/lib/holidays.ts           Nager.Date — public holidays during a trip's dates (no key)
src/lib/currency.ts           Frankfurter/ECB rates + minor-unit money helpers (no key)
src/lib/advisories.ts         UK FCDO + US State Dept travel advisories (no key) — read the country-code warning in it
src/lib/timezones.ts          Destination local time, offset vs the viewer, jet-lag note
src/lib/expenses.ts           Trip spend totals and settle-up math (integer minor units)
src/lib/flights.ts            Deep links out to flight/stay search — deliberately not an API, see the file
src/lib/currentUser.ts        Resolves the Supabase session to a User row; redirects to
                               /login (no session) or /onboarding (session, no User row yet)
src/lib/documents.ts          Document-expiry severity calculation (dashboard "Coming up" widget)
src/lib/packing.ts            Rule-based packing list generator (derives from itinerary category tags)
src/lib/costs.ts              Budget estimate + spend-category breakdown (lodging/food/transport/activities)
src/lib/countries.ts          Country-name normalization (usa/USA/United States → USA) — read before touching any user-facing country input field
src/lib/types.ts              Shared TS types + the canonical category/status label & color maps
src/utils/supabase/           Auth client factories (browser/server/middleware)
src/components/Reveal.tsx     Scroll-triggered fade-up (IntersectionObserver), used on most pages
src/components/               BackButton, TerrainHero (SVG illustrations), TripEditor, VisaBadge, etc.
src/app/                      Next.js App Router pages — one folder per route
src/app/login, /onboarding    Auth pages — NavBar hides itself on these routes
public/logo.png, icon-badge.png, hero-bg.jpg, og-image.jpg   Brand assets — see Design system
```

## Data model (Prisma)

- **User** — `id` is the **Supabase auth user's id**, set explicitly at signup (not an
  autogenerated cuid — see `completeOnboarding` in `src/lib/actions.ts`). A new signup gets
  a User row only after completing `/onboarding` (name + passport country); until then
  `getCurrentUser()` keeps redirecting there. `passportCountry` drives visa lookups.
- **HeldDocument** — `country`, `subtype` (e.g. "H1B"), `validUntil`. Powers both the cascade
  engine and the expiry-tracking dashboard widget. Scoped per-user.
- **Itinerary** / **ItineraryDay** — a trip plan, global/shared content (not user-scoped).
  `category` and `countries` are comma-separated strings, not JSON arrays (Prisma/seed
  convenience — see seed.ts for the split/join pattern). `relatedStateSlugs`
  (comma-separated `StateGuide.slug` values) is set on domestic itineraries that link out to
  a state guide instead of duplicating its food/culture content.
- **ItineraryNote** — `category` (currently always `"food_culture"`), `placeType` (dish/drink/
  tradition/culture), `name`, `description`. Only exists on **international** itineraries;
  domestic ones link out instead (see below).
- **VisaRule** — `passportCountry` + `destinationCountry` + `visaType`, optionally
  `requiresHeldDocumentCountry` for cascade rules (only India's rules use this — the other 7
  passports are strong enough not to need a cascade to most of these 13 destinations).
- **StateGuide** / **StatePlace** — `StatePlace.category` is one of `amazing` / `common` /
  `hidden` / `food_culture` (see canonical taxonomy below). `StateGuide.terrain` picks which
  hero photo renders (`mountain`/`desert`/`coast`/`forest`/`plains` — all 5 are in use; see
  `TerrainHero.tsx`).
- **UserTrip** — a saved/customized trip, optionally linked to an `Itinerary`, scoped
  per-user. `customDaysJson` is the live-edited day plan (source of truth once a trip
  exists, independent of the original Itinerary's days).
  - **`startDate` / `endDate` / `destinationCountry` are the forward-looking planning
    fields, and are not the same thing as `startedDate` / `completedDate`**, which are
    retrospective ("I went", "I got back") and predate them. Everything date- or
    place-aware reads the first three. Don't conflate them; the names are unfortunately
    close.
  - `shareToken` grants **edit** access via `/trip/[id]/join?token=`. `publicToken` +
    `isPublic` grant **read-only** access via `/t/[token]`. They are deliberately two
    different secrets — posting a shareToken publicly would hand everyone edit rights.
- **User.passportExpiry** — optional, and the thing the entry-readiness check is built
  around. Every user predates the field, so the UI has to handle null everywhere.
- **TripPackingItem** — state laid over the generated list in `src/lib/packing.ts`. Rows
  are created lazily on first tick/claim (upsert on `(tripId, label)`), not materialized
  at trip creation, so the generated list stays the source of truth until someone acts.
- **TripExpense** — `amountMinor` is an integer in the currency's minor unit, never a
  float. `amountMinorUsd` is stored at log time rather than recomputed, because the rate
  that applied on the day you spent it is the honest one; it's null when Frankfurter
  doesn't carry that currency (see below), and the UI reports those separately instead of
  dropping them from the total.
- **CountryFact / CountryClimate / CountryPhrase** — the country-guide data set. Same
  packed-string convention as the rest of this schema (comma-separated lists, pipe-
  separated source URLs, one JSON blob for transit passes); `src/lib/countryFacts.ts`
  owns all the parsing, don't split those strings inline in a component.

## Canonical taxonomies — do not invent new values without updating the label/color maps

Get these wrong and content silently renders in a generic gray fallback instead of the
correct color (this happened once already — 10 itineraries used `"budget-conscious"` as a
category *value* when the real value is `"budget"`; that string is only the *display label*).
Always check `src/lib/types.ts` before writing a new category value into seed data. Both
`scripts/validate_itineraries.py` and `scripts/validate_visa_rules.py` enforce these
mechanically for anything going through the content pipeline.

- **Itinerary `category`** (comma-separated, multiple per itinerary): `nature`, `city`,
  `water`, `splurge`, `budget`, `road-trip`, `off-the-beaten-path`
- **Itinerary `cost_tier`** (single value): `budget`, `mid`, `splurge`
- **StatePlace / ItineraryNote `category`**: `amazing`, `common`, `hidden`, `food_culture`
- **VisaRule `visa_type`**: `visa-free`, `visa-on-arrival`, `e-visa`, `advance-visa-required`
- **StateGuide `terrain`**: `mountain`, `desert`, `coast`, `forest`, `plains`

## Domestic vs. international itineraries — don't duplicate content

An itinerary's `food_culture` and `related_states` fields are **mutually exclusive by
design**:
- **International** itineraries (16 of them — UAE, Indonesia, Maldives+Sri Lanka, Turkey,
  Costa Rica, Georgia+Armenia, Colombia, Peru, Philippines, Serbia, Mexico, Japan, Thailand,
  Vietnam, Egypt, Morocco) carry their own `food_culture` array, because no state guide
  exists to link to.
- **Domestic** itineraries (98 of them across all 50 states — every state has exactly two;
  see "Content pipeline engines" below for how this got finished) set `related_states`
  instead — the itinerary detail page then renders a "this trip's food/culture depth lives in
  the [State] guide" card that links to `/state/[slug]`, rather than re-researching content
  that already exists. If you add a new domestic itinerary, follow this pattern — do not
  write a new `food_culture` array for a state that already has a guide.

## Content pipeline engines — how new content gets added now

Two parallel pipelines exist for growing content without a human read-through gate (an
explicit project-owner decision — see the "never fabricate" section above for the accepted
tradeoff). The pattern for both is identical:

1. **Dispatch research** — one agent per unit of work (a state, a passport), with a prompt
   that (a) points it at `CLAUDE.md` and the relevant `src/lib/types.ts` taxonomy, (b) shows
   it one real example object from the existing seed data, (c) requires real web search for
   every fact, and (d) tells it explicitly that there is no review step after it. Output is
   a JSON array written to a scratchpad path.
2. **Validate mechanically** — `python3 scripts/validate_itineraries.py <file.json>` or
   `scripts/validate_visa_rules.py <file.json>`. Checks taxonomy values, duplicates,
   required fields, source-URL presence (visa rules), day structure (itineraries). Rejects
   and reports anything that fails; **appends passing entries directly to the seed JSON**.
   These scripts cannot check facts, only structure — see their docstrings.
3. **Reseed** — `npm run seed` (safe to run against production; see above).

**Concurrency note, learned the hard way in round 3:** if you dispatch multiple research
agents in parallel and any of them have read access to this repo (they generally do), some
will notice `scripts/validate_itineraries.py` exists and — reasonably, since nothing told
them not to — run it themselves against the live seed file instead of just writing to their
assigned scratchpad path. If two agents do a read-modify-write on the same JSON file at
close to the same time, one's merge can silently clobber the other's. Mitigate by explicitly
telling each agent "write your output to this scratchpad path; merging is the orchestrator's
job, not yours" — and regardless, after all agents finish, diff the final seed file's
title list against every batch's own scratchpad output to confirm nothing was dropped before
trusting the total count.

**Itinerary engine status:** every state has a second, differently-themed itinerary, plus 16
international itineraries (114 total) — the "second itinerary per state" content-depth goal
is done, and round 4 added itineraries for Japan, Thailand, Vietnam, Egypt, and Morocco to
pair with that round's new visa destinations. A natural next round: a *third* itinerary for
the highest-tourism states, or itineraries for whatever new international destinations the
visa engine adds next (see below).

**Country-guide engine status:** a third pipeline, same shape as the two above, feeding
`data/country-facts-seed.json` through `scripts/validate_country_facts.py`. One research
agent per country, one JSON object out, covering entry/passport rules, health, money
norms, plugs, emergency numbers, transit passes, connectivity, a 12-month climate table
and a 12-16 phrase phrasebook. The validator is stricter than the other two because the
payload is: it rejects a record whose emergency numbers aren't dialable strings, whose
climate table isn't exactly twelve named months in order, whose phrasebook is missing the
phrases people actually need, or whose sources include Wikipedia or an aggregator. It
still cannot check whether a fact is *true* — read its docstring before assuming a green
run means anything more than that.

**Status: all 19 countries done** — the 18 visa destinations plus the USA — carrying ~270
official sources, a 12-month climate table each, and a 14–16 phrase phrasebook each.
**Check `data/country-facts-seed.json` for what's actually there rather than trusting this
count** — the Wikipedia incident below is what happens when you trust a number in this
file. `python3 scripts/validate_country_facts.py --check-existing` re-runs the full gate
over everything already merged; do that rather than assuming.

**`onward_ticket_required` is tri-state and the null means something.** `true` = the
destination's own rules state it, `false` = confirmed not required, `null` = nobody could
confirm either way (Peru, where migraciones.gob.pe returns 418 to fetchers and FCDO is
silent). The column is nullable and the seeders pass null through rather than coercing it
— an earlier version had `Boolean(value)`, which turned "we don't know" into "not
required", i.e. silently telling someone they don't need a return booking on the strength
of a failed search. `readiness.ts` renders null as its own "couldn't confirm, carry one
anyway" check. Don't "tidy" this back into a plain boolean.

**Recurring gaps, so nobody re-litigates them per country.** These are fields where the
"official sources only" rule genuinely can't be satisfied, and the right answer is `null`
rather than a plausible guess:

- **Plugs and voltage.** Almost no government publishes this. The canonical authority is
  the IEC's *World Plugs*, which is not an aggregator and is perfectly acceptable to cite
  — but iec.ch serves 403 to automated fetches, so agents often can't reach it. Where a
  tourism board or embassy states it, use that; otherwise leave the whole `power` block
  null. The UI hides the Power card entirely when there's nothing in it.
- **Tipping, card acceptance, cash culture.** Governments don't publish social norms.
  Several records have these null, correctly. Don't let an agent "fill them in".
- **eSIM support and SIM pricing.** Carrier marketing pages are not official sources and
  prices move; `null` is the honest answer more often than not.
- **Crowd notes and season ratings** in the climate table are editorial judgment, not
  sourced measurement, and the records say so. Temperatures and precipitation are hard
  met-service data; the `rating` is a call.
- **Climate normals are often old** (one country's are a 1974–1991 base period) because
  that's the newest the national met service supplies to the WMO. Records disclose the
  base period where it's unusual. Don't "correct" them against a weather app.

**Not every country has a six-month rule, and assuming one is its own kind of
fabrication.** Only **10 of the 19** researched countries actually impose six months or
more. Costa Rica's DGME sets the minimum at **one day** beyond the intended stay for
first-group nationalities (US, Canada, UK, Australia, Brazil, most of the EU); Japan and
Armenia require only validity for the length of the stay; the Maldives wants **one month**;
Serbia wants **90 days beyond departure**; Turkey's is 60 days beyond the *permitted*
stay, which works out at 150 days from entry and is encoded as 5 months from entry rather
than 2 from exit precisely because the literal reading under-warns on short trips. `validate_country_facts.py` emits a *warning*
(not an error) for `basis: "exit"` with `months: 0`, which is exactly Costa Rica's shape —
that warning is expected there and should not be "fixed" by inventing months. Costa Rica
has now been corrected twice in this project's history (the US-passport stay length, and
this); treat anything you "already know" about it with suspicion.

**Timezone labels must agree with the IANA database, not with press reports.** Morocco
announced in June 2026 that it was abandoning GMT+1 and returning to GMT, and Moroccan
press reported the switch landing on 20 September 2026 — but no government page confirms
the date and the IANA tz database still places Morocco at UTC+1. `timezone_label` is
therefore UTC+1, with the whole story in `timezone_note`. The reason this matters beyond
accuracy: `LocalTime` computes the clock from `primary_timezone` through the IANA database,
so a label that disagrees with IANA puts a contradiction on the same card — the header says
UTC+0 and the clock next to it says GMT+1. Follow IANA for the label; it also means the
live clock corrects itself automatically once a real change is recorded there.

**When two official sources disagree, surface both — don't pick silently.** This has come
up for real. Egypt's emergency numbers differ between the US Embassy in Cairo (police 122,
tourist police 126, ambulance 123) and Global Affairs Canada (112 / 113 / 110). The record
carries the in-country mission's numbers in the structured fields, names the Canadian set
in `emergency.notes` with "if 122 or 123 don't connect, those are worth trying", and leaves
`fire` **null** because no official source confirmed one — the aggregators all say 180 and
that is exactly the field where a guess gets somebody hurt. Same pattern for Thailand's
proof-of-funds figure (embassy says 20,000 THB, FCDO says 10,000 — the record states both
and says carry the higher). The rule: structured field gets the best-supported value,
`notes` carries the conflict, and a life-safety field with no confirmation stays null.

Several government domains block automated fetches outright (mofa.go.jp and the Japanese
consulates, travel.state.gov, immigration.go.th, mohap.gov.ae, tmd.go.th fails TLS). When
the destination's own site is unreachable, a *foreign* government's page about that
country — UK FCDO, Global Affairs Canada — is an acceptable fallback, and the record is
expected to say so in the field rather than implying a first-hand citation.

**Visa engine status:** 8 passports (India, USA, UK, Canada, Australia, Germany, Singapore,
Brazil) × 18 destinations = 154 rules, all cross-checked with `npx tsx` against the live
database after merging (verify every (passport, destination) pair actually resolves via
`src/lib/visa.ts`'s logic, not just that the row exists). Round 4 added Japan, Thailand,
Vietnam, Egypt, and Morocco as new destinations across all 8 existing passports (40 new
rules); Thailand's visa-exemption policy change took effect September 15, 2026 — that
source is worth a fresh check now that the date has passed. A round-5 sourcing audit found
**49 of the then-154 rules** (India/USA/UK across all 13 original destinations, plus
Brazil→Armenia/Turkey/UAE) citing an aggregated Wikipedia page rather than an official
source — far more than the single earlier note here suggested. All 49 were re-researched
(one research agent per destination, official government/embassy sources only) and patched
in place; the process caught several real factual errors along the way, not just sourcing
gaps (Costa Rica's US-passport stay was wrong at 90 days, actually 180; Sri Lanka's US/UK
rows were misclassified as visa-on-arrival when they're actually a mandatory advance ETA;
Armenia's UK entry was full visa-free, not "visa-on-arrival effectively visa-free"; the
Philippines' visa-free start date was off by three weeks). Zero Wikipedia sources remain in
`data/visa-rules-seed.json` as of this round.
Expanding to new destinations further, or a third itinerary per state, is the natural next
step through the existing pipeline.

## The itinerary draft generator (`scripts/generate_itinerary_draft.py`)

```bash
python3 scripts/generate_itinerary_draft.py <state-slug> [--stops 9]
```

Pulls a state's guide data, selects a mix of amazing/common/hidden places, clusters them by
`nearest_town`, and drafts day-by-day structure with inferred category tags. **It leaves town
order and drive times for a human review pass** — this is a different, older tool than the
content pipeline engines above (which use live web research per itinerary instead of
clustering existing state-guide places). Still useful as a starting skeleton if you want to
hand-review a route yourself rather than dispatch a research agent for it.

## Design system

Reworked in a full pass toward an Apple.com-style aesthetic — bold, spacious, and
typography-driven — after starting as a warmer "travel notebook" look. Current state:

- **Colors** (`tailwind.config.ts`): `paper` #FBFBFD / `paperDark` #F5F5F7 (near-white
  canvas, not the original warm cream), `ink` #1D1D1F (near-black, not navy), `coral` #FF5A5F
  (the one vivid brand accent, reserved for CTAs), `stamp` #F5A623, `stampRed` #E63946,
  `forest` #2FA84F, `teal` #06B6D4. Category chip colors are a separate map in `types.ts`.
- **Type**: **Inter only** — Fraunces (the original serif display font) was dropped
  entirely. `font-display` (a Tailwind utility mapped in `tailwind.config.ts`) is
  bold-weighted and tight-tracked via a global CSS rule in `globals.css`, so every existing
  `font-display` usage sitewide got the heavier, tighter look automatically without
  per-component changes. IBM Plex Mono survives for small uppercase "eyebrow" labels only.
- **Shape**: large rounded corners (`rounded-card`/`rounded-panel`/`rounded-hero` in
  `tailwind.config.ts`, 1rem/1.5rem/2rem), not the original 2px "notebook" sharp corners.
  Cards are borderless, separated by soft neutral shadows (`shadow-paper`/`shadow-paper-lg`)
  instead of hairline borders.
- **Buttons**: `.btn-pill` (`.btn-pill-primary` black, `.btn-pill-accent` coral) and
  `.btn-ghost` (text link + chevron) in `globals.css` — use these instead of ad hoc button
  classes for new UI.
- **Motion**: `<Reveal>` (`src/components/Reveal.tsx`) fades a section up into view the
  first time it crosses into the viewport (IntersectionObserver-based). Used on most
  sections across dashboard/state/itinerary pages — wrap new major sections in it for
  consistency.
- **Motifs kept from the original design**: circular "stamp" badges for visa status
  (`.stamp-mark` in `globals.css` — no longer rotated, that read as more "boutique journal"
  than Apple), ticket-perforation dividers between itinerary days. State guide hero banners
  now use real (AI-generated) terrain photography instead of the original hand-built SVGs —
  see Roadmap and `TerrainHero.tsx`.
- **Brand assets** (`public/`): `logo.png` (header wordmark), `icon-badge.png` (small
  in-UI badge, e.g. login page), `hero-bg.jpg` (soft abstract background behind the
  login/onboarding card), `og-image.jpg` (social share card, wired into `layout.tsx`
  metadata). `src/app/icon.png` and `apple-icon.png` are the favicon/app-icon via Next's
  file-convention (served at `/icon.png`, `/apple-icon.png` automatically). All were
  AI-generated then cropped/recompressed — see git history ("Add real brand assets") for
  the exact prompts if you need to generate more in the same style.
- **Mobile nav**: iOS-style bottom tab bar (icons, thumb-reachable) below the `sm`
  breakpoint; desktop nav is a slim, translucent, text-only bar (apple.com-style, no icons)
  — these are deliberately different patterns for the two form factors, not an oversight.
- **Accessibility**: real back navigation using browser history (`router.back()`), not static
  links — this preserves filter state and scroll position when returning from a detail page.
  Keyboard nav and focus-visible states were added as an explicit pass, not a default.

## Two other builds exist, but this repo is the one to develop going forward

Earlier in this project's life, a Claude.ai in-chat React artifact and a single-file
standalone HTML build were maintained in lockstep with this Next.js app, for previewing
without a dev environment. They are **not** kept in sync anymore — treat this Next.js repo,
deployed at nextstamp-app.vercel.app, as the sole source of truth.

## Roadmap — in priority order, with reasoning

1. ~~**Auth.**~~ Done — Supabase Auth, magic link. Every table already had the `userId`
   fields this needed, so it was additive.
2. ~~**Collaborative trip planning.**~~ Done — real-time shared editing of a `UserTrip` via
   Supabase Realtime (the project owner's explicit choice over polling, to avoid new infra).
   A `TripCollaborator` join table + the trip's `shareToken` power an invite-link flow
   (`/trip/[id]/join?token=...`); `getTripWithAccess()` in `src/lib/trips.ts` is the single
   place that decides owner-vs-collaborator-vs-nobody, used by both the page and every
   trip-mutating server action. Realtime is scoped by Postgres RLS (`UserTrip` has RLS
   enabled with a SELECT policy limited to the owner or a collaborator) so the live-update
   channel can't leak a trip's content to someone who isn't on it — see "Known loose ends"
   for the pre-existing bug this fix closed. TripEditor shows a "co-traveler updated this
   trip" banner rather than silently overwriting in-progress edits — a full refresh (via a
   `key={updatedAt}` remount) is one click away but not automatic.
3. ~~**Trip lifecycle beyond "can I go".**~~ Done. A trip now carries real travel dates
   and a destination, and a user carries a passport expiry — three fields that were
   missing and that blocked almost everything else. On top of them: the entry-readiness
   check (`src/lib/readiness.ts`), public holidays during the stay, month-by-month climate
   for the travel month, live currency, both governments' travel advisories, destination
   local time and jet lag, a stateful packing list co-travelers can claim items on,
   expenses with settle-up, a read-only public trip link (`/t/[token]`), browsable country
   guides (`/countries`, `/country/[slug]`), and deep links out to flight/stay search.
   See "External APIs" and "Entry readiness" above for the parts with teeth.
4. **Booking-email import** (TripIt-style: forward a confirmation, auto-populate the trip) —
   explicitly deferred by the project owner: needs a real inbox to receive into (an email
   webhook provider — e.g. Postmark/SendGrid inbound parsing) plus a parsing pipeline, which
   is new infrastructure and a new recurring cost, not a code-only change. Revisit when
   that cost is worth taking on.
5. ~~**Real photography.**~~ Done, via AI-generated (Gemini) rather than licensed photography
   — the project owner's call once an Unsplash/Pexels API key turned out to be more friction
   than just generating images the same way the brand assets were made. Five terrain photos
   (`public/terrain-{mountain,desert,coast,forest,plains}.jpg`) replaced the hand-built SVGs
   in `TerrainHero.tsx`, one per `StateGuide.terrain` value, reused across every state that
   shares a terrain. Watch for this if you regenerate any of these: the first batch came
   back from Gemini/Drive with scrambled filenames (content didn't match the requested
   terrain in the name) — always eyeball each image against its intended terrain before
   wiring it in, don't trust the filename.
6. **Payment** — deferred by design; the project owner chose to skip it for this round.
   Worth revisiting now that there's materially more behind a login than there was.
7. ~~**Weather and maps.**~~ Built, and both **ship dark until a key is set** — the app is
   fully functional without either, so adding a key is the only remaining step.
   - **Weather** (`src/lib/weather.ts`, `WeatherPanel`): **WeatherAPI.com**, env var
     `WEATHER_API_KEY`. Deliberately *not* Open-Meteo, which needs no key at all but
     whose free tier is explicitly **non-commercial** and collides with the eventual
     paid tier. The nice part: a real forecast only exists ~2 weeks out, and rather than
     buy WeatherAPI's long-range `future.json` to paper over that, the module falls back
     to the country guide's own met-service climate normals and *says* they're averages.
     So the free tier is genuinely sufficient.
   - **Maps** (`src/components/PlaceMap.tsx`): **MapLibre GL** (open source) rendering
     **MapTiler** tiles, env var `NEXT_PUBLIC_MAPTILER_KEY`. Raw OSM tiles aren't
     permitted at app scale and Google now requires a billing account. The library is
     `import()`ed lazily so its ~200KB stays off every page that has no map.
   - **Coordinates** come from `scripts/geocode_places.py`, run **once at authoring
     time** into `data/state-guides-seed.json` — Nominatim allows 1 req/sec, demands a
     real User-Agent, and forbids autocomplete, so a request-time lookup is out. Two
     things that script does which matter: it rejects any hit outside the state's
     bounding box (a naive first-hit lookup drops Montana trailheads in Florida), and it
     skips `food_culture` rows entirely because dishes and traditions have no location.
     Unresolved places keep `latitude: null` and are simply **left off the map** rather
     than approximated. It shells out to `curl` rather than using `urllib`, which
     measured ~45s per request against Nominatim versus ~0.4s — the difference between a
     half-hour job and a 35-hour one.
   - See `.env.example` for both keys and what happens without them.
8. **Content depth** — the "second itinerary per state" goal is **done** (all 50 states,
   114 total itineraries, 16 of them international). Visa coverage is at 8 passports × 18
   destinations (154 rules) after round 4 added Japan, Thailand, Vietnam, Egypt, and
   Morocco. A natural next batch is more new destinations (paired with itineraries for
   those same countries), or a third itinerary per state for the highest-tourism ones. No
   architecture decision needed, just more research batches through the existing pipeline.

## External APIs — what we use, and what we deliberately don't

Four external data sources, all free and none requiring a key, credit card, or signup.
Every one of them degrades to null/empty rather than throwing: a trip page must never
fail because gov.uk was slow.

| What | Source | Key? | Notes |
|---|---|---|---|
| Public holidays | Nager.Date | none | ISO 3166-1 alpha-2 codes. Cached 24h. |
| Exchange rates | Frankfurter (ECB) | none | **Only ~30 currencies.** See below. |
| UK advisories | gov.uk Content API | none | OGL v3.0 — attribution is required and is rendered in `DestinationBriefing`. Don't remove it. |
| US advisories | travel.state.gov RSS | none | **Country codes are FIPS, not ISO.** See below. |

Three things here that are easy to get wrong, all found by testing against the live
services rather than by reading their docs:

- **The US State Department feed's `Country-Tag` is FIPS 10-4 / GENC, not ISO 3166-1.**
  Japan is `JA`, Vietnam `VM`, Serbia `RI`, Sri Lanka `CE`, Turkey `TU`, Philippines
  `RP`, Georgia `GG`. This doesn't merely fail to match — the two schemes *collide*, and
  the collisions are silent and wrong. Matching on ISO codes returned **Madagascar's**
  advisory for Morocco and **Russia's Level 4 "Do not travel"** for Serbia. So
  `getStateDeptAdvisory` matches on the country **name**, exact comparison only, with no
  prefix fallback (that's how Niger matches Nigeria and Sudan matches South Sudan).
  There are regression tests pinning this in `src/lib/advisories.test.ts` — keep them.
- **That feed is one ~1MB document for every country, and travel.state.gov throttles.**
  A throttled response comes back HTTP 200 with a short body containing no items, which
  would read as "no advisory anywhere" rather than as an error. `advisories.ts` shares
  one in-flight fetch process-wide, validates the body actually contains `<item>`, and
  doesn't cache a bad response.
- **Frankfurter only carries the ~30 currencies the ECB publishes.** Most NextStamp
  destinations aren't among them (VND, EGP, MAD, LKR, MVR, GEL, AMD, RSD, PEN, COP, CRC,
  AED). The UI says so explicitly rather than showing a guessed rate, and unconvertible
  expenses are reported separately rather than silently excluded from a total.

**Not built, on purpose:** flight and hotel *search*. There is no genuinely free
production flight API — Amadeus's self-service environment returns cached fares that
won't match reality, Duffel is priced for selling seats ($3/order + 1%), Kiwi closed
self-serve access in 2024, Skyscanner is partner-application only, and the "Skyscanner"
listings on RapidAPI are unofficial scrapers. `src/lib/flights.ts` deep-links out to
Google Flights / Kayak / Google Hotels with the trip's dates and route prefilled instead.
Showing a fare we can't stand behind would break the one rule at the top of this file.

**Also deliberately absent: visa processing lead times.** The entry-readiness check tells
you a visa must be arranged in advance and counts down the days to departure, but it does
not say "allow 2-3 weeks" — nobody has researched a per-destination lead time into
`CountryFact`, and inventing a plausible one is exactly the fabrication this project
refuses. If you want that feature, add a researched field; don't add a heuristic.

## Entry readiness (`src/lib/readiness.ts`)

The layer that turns "does this passport need a visa for that country" into "is anything
going to stop *this trip*". It needs `UserTrip.startDate`/`.endDate`/`.destinationCountry`
and `User.passportExpiry`, which is why those four fields exist.

Checks, in the order they fire: destination set, dates set, passport validity against the
destination's own rule, the visa answer as a deadline, rule freshness, whether a
cascade-supporting document stays valid *across the travel dates* (not merely today),
length of stay vs the permitted maximum, blank pages, onward ticket, required
vaccinations, and any other stated entry requirement.

`passportValidityVerdict()` is pulled out as a pure function and tested directly, because
it's the one calculation here where being wrong has a real cost — someone books a
non-refundable trip they can't take, or cancels one they could have. Two subtleties worth
not "simplifying" away:

- Months are added by calendar, clamped to the end of a shorter month (Aug 31 + 6 months
  is Feb 28/29, not Mar 2/3). Treating a month as 30 days makes a borderline passport read
  as fine when it isn't.
- A margin under 30 days is a **warning, not a pass** — including where the rule is only
  "duration of stay". A passport expiring days after you land home leaves nothing for a
  delayed flight, and plenty of airlines apply a six-month rule at check-in regardless of
  what the destination requires.

## Sign-in email is rate limited — the one thing blocking real users

**Supabase's built-in auth email service sends 2 messages per hour, per
project.** Not per user — per project. Supabase documents it as "best-effort
only" and "not intended for production": it exists for testing templates and
building demos. Hit it and `signInWithOtp` returns `email rate limit exceeded`
(or the code form `over_email_send_rate_limit`), and nobody can sign in until
the hour rolls over.

Magic link is currently the *only* way into this app, so this caps the entire
product at two sign-ins an hour. It is the single highest-priority operational
fix, and it is a dashboard change rather than a code one:

1. Create an account with an SMTP provider — Resend, Postmark, AWS SES,
   SendGrid, ZeptoMail and Brevo are all supported; Resend's free tier is the
   usual choice for a project this size.
2. Supabase dashboard → Authentication → Emails → SMTP Settings → enable custom
   SMTP and enter the provider's host, port, user and password.
3. Authentication → Rate Limits → raise the email limit. Custom SMTP starts at
   **30 messages per hour** and is adjustable from there.

Until that's done, `friendlyAuthError` in `src/lib/authErrors.ts` at least
explains the failure in human terms rather than showing Supabase's raw string —
it tells the person it's our limit, not their mistake, and that retrying won't
help. That's damage control, not a fix.

A second, larger fix worth considering: add an OAuth provider (Google is the
obvious one for a travel app) so there's a sign-in path that sends no email at
all. That's a real code change — `signInWithOAuth`, a provider configured in
Supabase, and a callback already exists at `src/app/auth/callback/route.ts`.

## Known loose ends

- The Vercel personal access token used for CLI deploys during development is still active
  on the project owner's account — should be revoked at vercel.com/account/tokens once no
  longer needed for assistant-driven deploys.
- If you audit sourcing again, don't trust a stale count in this file (see the Wikipedia
  incident just above — the number here was wrong by 16x for a while) — regrep
  `data/visa-rules-seed.json` for `wikipedia` yourself rather than assuming this doc is
  current.
- **Fixed while building collaborative planning, but worth knowing about**: `/trip/[id]`
  had no access check at all (any signed-in user, or even a logged-out one, could view and
  edit any trip by guessing/knowing its cuid), and `updateTripStatus`/`updateTripDays`/
  `deleteTrip` in `src/lib/actions.ts` took a bare `tripId` with no ownership check either —
  a real IDOR bug, not a hypothetical. Now everything routes through
  `getTripWithAccess()`. If you add another trip-mutating action, route it through that
  helper too rather than trusting a `tripId` parameter on its own.
- **Found while fixing the above, and turned out to be pre-existing (not something this
  round introduced)**: `getCurrentUser()`'s `redirect("/login")` silently failed to produce
  a real HTTP redirect on `/my-trips` — a fresh, no-JS request just got a blank 200 page
  forever. Root cause: `/my-trips` has a sibling `loading.tsx`, and Next.js 14's App Router
  has a known bug where `redirect()` called from a page whose route segment is wrapped in a
  Suspense boundary (i.e. has a `loading.tsx`) only reaches the client-side router, not the
  actual HTTP response, for the initial document request. Fixed by gating `/my-trips` in
  `src/utils/supabase/middleware.ts` instead of relying on the page-level `redirect()` (which
  is still there as a defense-in-depth backstop, e.g. for direct server-action calls).
  **If you add a `loading.tsx` to any other route that also does a hard `getCurrentUser()`
  redirect, it will have this same bug** — check with curl (a real browser hides it, since
  it does eventually redirect client-side after hydration) and add the same middleware
  gate rather than assuming the page-level redirect is enough.

## Incident: `npm run seed` is not actually crash-safe against a mid-run connection drop

Round 5 (the Wikipedia-sourcing fix above) hit this in production. `npm run seed` deletes
all of `Itinerary`/`VisaRule`/`StateGuide` up front, then recreates everything row by row
over one long-lived pooled connection (Supabase port 6543, PgBouncer). Twice in a row, that
connection got dropped mid-script (`P1017 "server has closed the connection"`) — once
partway through itineraries, once partway through visa rules — each time leaving the
**live production site** with the already-deleted tables empty (state guides and visa
rules both hit zero at one point) until a full rerun happened to complete. The doc claim
above ("safe to rerun against production") was true for idempotency but not for
reliability — a crash mid-run left production in a worse state than before the run, for as
long as it took to notice and rerun.

Fixed in `prisma/seed.ts`: a `withRetry()` wrapper around every individual `.create()` call
reconnects (`$disconnect()` + a fresh `PrismaClient`) and retries up to 3 times on a
connection-drop error, instead of letting the whole script die. If you see `P1017` again
even with this in place, the retry count or the delete-then-recreate structure itself
(e.g. seeding into a staging table and swapping, or batching with `createMany` where nested
relations allow it) is the next thing to reconsider — this fix addresses the failure mode
we actually observed, not every possible one.

## Tests

`npm test` (vitest). `vitest.config.mts` exists for two reasons worth knowing: it maps the
`@/` path alias (every test used to live in `src/lib` with relative imports, so vitest
never needed it until a component test did), and it turns on the automatic JSX runtime.
It has to be `.mts` rather than `.ts` — this package isn't `"type": "module"`, so a `.ts`
config gets `require()`d and vitest 4's config entry point is ESM-only.

Component tests render server components straight to a string with
`renderToStaticMarkup` (see `EntryReadiness.test.tsx`). That's deliberate: the trip page
is behind a real login, so a browser pass on it means holding a live session, and these
components take finished data as props anyway.

## How to verify a change before considering it done

This project's development pattern has consistently been: build, then actually test the
behavior (via a headless browser or direct DB query), not just read the code and assume it
works. Specific things worth checking after any change:
- `npm run build` clean (not just `dev` — see above)
- If you touched seed data: `npm run seed` completes without error, and spot-check the
  affected page renders correctly (state guide, itinerary detail, or visa status depending
  on what changed)
- If you touched a taxonomy value: grep for it across `data/*.json` to make sure nothing
  else silently relies on the old value — or better, run the two validator scripts against
  the full existing dataset (not just new candidates) to catch it mechanically
- If you touched auth/session logic: test with a real signup (or the admin-generate-link
  trick above), not just by reading the code — session/cookie bugs don't show up in a diff
- If you touched anything user-facing: check it renders correctly authenticated AND
  unauthenticated (most pages redirect to `/login`, a few — `/states`, `/state/[slug]` — are
  intentionally public)
