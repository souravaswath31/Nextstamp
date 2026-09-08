# NextStamp

A trip-planning tool built around one real fact: an Indian passport plus a valid US visa
unlocks visa-free or on-arrival access to 25+ countries neither one gets you alone. NextStamp
checks that kind of thing automatically — against your actual held documents, not a generic
"visa requirements" page — and backs it with a full USA destination library and real itinerary
plans, all sourced and dated rather than generated on the fly.

> **Why this exists:** a good LLM prompt can generate a plausible-sounding itinerary in seconds.
> What it can't do is remember your documents between sessions, warn you before one expires and
> silently takes your visa-free access with it, or guarantee the "best time to visit" line isn't
> quietly out of date. This project is an attempt to build the parts of a travel tool that
> actually require *state* and *verification*, not just better prompting.

## What's in it

**Content**, all independently sourced and cross-checked, not bulk-generated:
- **50 US state guides** (840 places) — each with Amazing Places (hiking/adventure/drives),
  Common Places (top attractions), Hidden Gems, and Food/Drink/Culture, plus practical info
  (best time to visit, permits, altitude/climate notes, what to pack).
- **59 full itineraries** — day-by-day trip plans across all 50 states and 11 international
  destinations, each reviewed for actual geographic coherence (see Notable Decisions below —
  this mattered more than expected).
- **75 visa rules across 5 passports** (India, USA, UK, Canada, Australia) against 13
  international destinations, every rule with a real source URL and a verification date.

**The visa engine** (`src/lib/visa.ts`) is the core differentiator: it resolves status per
destination per user, and implements a cascade — a rule can require a second held document
(e.g. "requires a valid US visa") and only applies if the user's profile actually has one, live.
Country input is normalized (`usa`, `USA`, `United States` all resolve the same way) so a typo
doesn't silently break the one feature the whole product is built around.

**Trip planning tools**, generated from the same underlying data rather than hardcoded per trip:
- Packing lists, derived from each itinerary's category tags
- Budget breakdowns, split by real vacation-spending research (lodging/food/transport/activities)
- Document expiration tracking — a dashboard widget that warns you before a held document expires
  *and* names exactly which destinations' visa-free access depends on it
- A day-by-day trip customizer (reorder, add/remove days, swap budget tier with live recalculation)
- Trip tracking: Idea → Planning → Booked → Completed

## Notable decisions

A few things worth calling out for anyone reviewing this as a portfolio piece — these are the
parts that took actual judgment, not just implementation:

- **The itinerary generator (`scripts/generate_itinerary_draft.py`) deliberately doesn't guess
  geography.** It clusters a state's researched places by town and drafts day structure, but
  leaves town *order* and drive times for manual review — because there's no coordinate data to
  base that on, and fabricating a plausible-looking route would be exactly the kind of invented
  fact this project avoids everywhere else. Running it raw caught real problems (a draft that
  put Yellowstone and Glacier National Park — 400 miles apart — in the same week-long trip)
  that a fully-automated version would have shipped silently.
- **Domestic itineraries link to their state guide instead of duplicating content.** An Alaska
  trip and the Alaska state guide both exist; only one holds the food/culture research, and the
  other links to it. Avoids drift between two copies of the same information.
- **Sourcing discipline**: visa rules carry a `sourceUrl` and `lastVerifiedDate`, and the UI
  visibly flags anything unverified or old rather than presenting stale data with false
  confidence.
- **Accessibility and mobile weren't an afterthought pass** — keyboard navigation, focus states,
  and a proper thumb-reachable bottom nav on mobile were added after an explicit audit, not
  assumed to be fine because the desktop layout looked right.

## Stack

Next.js 14 (App Router) + TypeScript + Tailwind, Prisma ORM, SQLite for local dev (zero external
setup). No auth yet — intentionally single-user for now, but every table already has `userId`,
so multi-user auth is additive, not a migration.

## Getting started

```bash
npm install
npm run db:push   # creates prisma/dev.db from the schema
npm run seed      # loads all itineraries, state guides, visa rules, and the user profile
npm run dev
```

Open http://localhost:3000.

## Project structure

```
prisma/schema.prisma       Data model — Itinerary, StateGuide, VisaRule, UserTrip, etc.
prisma/seed.ts             Seeds the DB from the JSON data files below
data/                      All content: itineraries, state guides, visa rules (JSON)
scripts/                   generate_itinerary_draft.py — the reusable itinerary generator
src/lib/visa.ts            Visa status resolution + cascade logic
src/lib/documents.ts       Document expiry severity + urgency calculation
src/lib/packing.ts         Rule-based packing list generator
src/lib/costs.ts           Budget estimation + spend-category breakdown
src/app/                   Next.js App Router pages
```

## License

MIT — see [LICENSE](LICENSE).
