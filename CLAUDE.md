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

`npm run seed` is **safe to rerun against production** — it only touches global content
(Itinerary/VisaRule/StateGuide and their children), never User/HeldDocument/UserTrip. See
"Data model" below for why.

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
data/itineraries-seed.json   109 itineraries: day-by-day, food_culture (international only), related_states (domestic only)
data/state-guides-seed.json  50 states × ~17 places each (amazing/common/hidden/food_culture)
data/visa-rules-seed.json    114 rules: 8 passports × up to 13 destinations each
scripts/generate_itinerary_draft.py   Draft generator for a state's places (see below)
scripts/validate_itineraries.py       Content pipeline gate — see "Content pipeline engines"
scripts/validate_visa_rules.py        Content pipeline gate — see "Content pipeline engines"
src/lib/visa.ts               Visa status resolution + cascade logic (the core differentiator)
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
  hand-built SVG hero illustration renders (`mountain`/`desert`/`coast`/`forest`/`plains` —
  all 5 are in use).
- **UserTrip** — a saved/customized trip, optionally linked to an `Itinerary`, scoped
  per-user. `customDaysJson` is the live-edited day plan (source of truth once a trip
  exists, independent of the original Itinerary's days). `coTravelers` is a string field
  sitting unused, intentionally, for when collaborative planning gets built.

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
- **International** itineraries (11 of them — UAE, Indonesia, Maldives+Sri Lanka, Turkey,
  Costa Rica, Georgia+Armenia, Colombia, Peru, Philippines, Serbia, Mexico) carry their own
  `food_culture` array, because no state guide exists to link to.
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

**Itinerary engine status:** every state has a second, differently-themed itinerary (109
total itineraries) — the "second itinerary per state" content-depth goal is done. A natural
next round: a *third* itinerary for the highest-tourism states, or itineraries for whatever
new international destinations the visa engine adds next (see below).

**Visa engine status:** 8 passports (India, USA, UK, Canada, Australia, Germany, Singapore,
Brazil) × 13 destinations = 114 rules, all cross-checked with `npx tsx` against the live
database after merging (verify every (passport, destination) pair actually resolves via
`src/lib/visa.ts`'s logic, not just that the row exists). One open quality note: 3 of
Brazil's sources are Wikipedia rather than official government pages (Armenia, Turkey,
UAE) — structurally valid but below the "official source where possible" bar the other 111
rules hit. Expanding to new destinations (not just new passports against the existing 13)
is a natural next step, ideally paired with itineraries for those same new destinations.

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
  than Apple), ticket-perforation dividers between itinerary days, hand-built SVG terrain
  illustrations (no photography — see Roadmap) that vary by `StateGuide.terrain`.
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
2. **Collaborative trip planning** — real-time shared editing of a `UserTrip` with people
   you're actually traveling with. Was blocked on auth; **auth now exists, so this is
   unblocked**. Needs its own architecture decision (polling-based co-editing vs. a realtime
   channel — Supabase has Realtime built in, which would avoid a new infra dependency) before
   starting; don't guess on this without checking with the project owner first.
3. **Booking-email import** (TripIt-style: forward a confirmation, auto-populate the trip) —
   was blocked on auth; **now unblocked**. Needs a real inbox to receive into (an email
   webhook provider — e.g. Postmark/SendGrid inbound parsing) plus a parsing pipeline; this
   is new infrastructure and a new recurring cost, not a code-only change. Check scope before
   starting.
4. **Real photography** — blocked on the project owner obtaining a free Unsplash or Pexels
   API key. Until then, the hand-built SVG terrain illustrations are the intentional look,
   not a placeholder to feel bad about.
5. **Payment** — deferred by design until the above are further along.
6. **Content depth** — the "second itinerary per state" goal is **done** (all 50 states,
   109 total itineraries). Visa coverage is at 8 passports × 13 destinations (destinations
   haven't been expanded yet, only passports) — a natural next batch is new destinations
   (paired with itineraries for those same countries), or a third itinerary per state for
   the highest-tourism ones. No architecture decision needed, just more research batches
   through the existing pipeline.

## Known loose ends

- 3 of the 114 visa rules (Brazil → Armenia/Turkey/UAE) cite Wikipedia rather than an
  official government source — structurally valid, below the project's usual sourcing bar.
  Flagged, not yet re-researched.
- The Vercel personal access token used for CLI deploys during development is still active
  on the project owner's account — should be revoked at vercel.com/account/tokens once no
  longer needed for assistant-driven deploys.

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
