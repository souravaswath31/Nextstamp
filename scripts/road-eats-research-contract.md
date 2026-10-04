# Road-eats research contract

Handed to each research agent, one per state (or per country for international routes),
together with a generated brief listing that region's itineraries and their days
(`python3 scripts/road_eats_brief.py <state-slug>`).

## Why this is the riskiest content in the project

A restaurant is the most perishable fact NextStamp will ever hold. Places close, change
owners, go seasonal, drop days. A visa rule changes a few times a year; a restaurant can
vanish between your research and the traveller's arrival. And a traveller who drives 40
minutes for a diner that closed in March has been actively harmed by us.

So the bar is not "sounds plausible and well reviewed". **The bar is: you saw current
evidence it is operating, and you can say exactly what and where.** If you cannot, the
place does not go in. Fewer eats is always better than one unverified eat.

There is no human review after you. Per CLAUDE.md, never fabricate a fact. A missing eat
is fine; a confident wrong one is not.

## What to produce

ONE JSON object, written to the path you're given, no markdown fences:

```json
{
  "region_key": "texas",
  "last_verified_date": "2026-10-03",
  "stops": [
    {
      "town": "Terlingua",
      "note": "Only a handful of full-service places near Big Bend's west entrance; the park itself has a single lodge restaurant. Pack lunch for trail days.",
      "note_source_url": "https://www.nps.gov/bibe/planyourvisit/...",
      "eats": [
        {
          "name": "Exact name as the venue writes it",
          "kind": "regional",
          "meal": "dinner",
          "what_to_order": "One sentence, using only dishes the source page itself mentions.",
          "why": "One sentence on why it is worth a stop on a road trip — the local fact, not a generic superlative.",
          "price_tier": "$$",
          "hours_note": "Closed Mondays; open Thursday-Sunday only in summer",
          "open_evidence": "Own website lists 2026 hours and current menu (viewed 2026-10-03)",
          "source_url": "https://official-page",
          "source_name": "Venue's own website"
        }
      ]
    }
  ],
  "day_map": [
    { "itinerary_title": "Big Bend National Park, Texas", "day_number": 1, "town": "Terlingua" },
    { "itinerary_title": "Big Bend National Park, Texas", "day_number": 4, "town": null }
  ]
}
```

## Field rules

**`stops`** — one entry per town where a traveller on these routes would actually eat.
Day titles are often an *activity* ("Lost Mine Trail", "Cadillac Mountain"), not a place,
and nobody eats on a trail. Pick the town you would really stop in — usually the gateway
town. Aim for 2–3 eats per stop. One stop with only 1–2 verified eats is fine and honest.

**`day_map`** — one entry for EVERY day of EVERY itinerary in your brief, using the exact
`itinerary_title` and `day_number` from the brief. `town` must be one of your `stops`, or
`null` for a day with no realistic answer (e.g. "Depart"). Several days may share a town.

**`note`** (optional, per stop) — only where the honest answer is "options are thin":
no dining inside a national park, the nearest full meal is 30 miles on, pack a cooler.
This is useful, not filler. Needs a `note_source_url` (an NPS page for in-park dining is
ideal). Omit both if there is nothing worth saying.

**`kind`** — exactly one of: `diner`, `bbq`, `bakery`, `cafe`, `brewery`, `market`,
`regional`, `dessert`, `drive_in`, `seafood`. Use `regional` for a restaurant known for a
local dish that fits none of the others.

**`meal`** — exactly one of: `breakfast`, `lunch`, `dinner`, `snack`, `any`. A road-tripper
plans around the drive, so this matters: across a stop, try to cover more than one meal
rather than three dinner places.

**`price_tier`** — `$`, `$$`, `$$$`, or `null`. Only when a source states prices. `null`
is the usual answer. Do not infer it from vibes.

**`hours_note`** — closed days, seasons, cash-only, no reservations: **only what a source
states.** `null` means nothing was stated; it does NOT mean "open year-round". Seasonal
places (Maine lobster shacks, mountain-town cafes) are the main reason this field exists —
a traveller must not be sent to a shuttered shack in February.

**`open_evidence`** — REQUIRED, one sentence: what you saw that shows it is currently
operating, and where, with the date you viewed it. "Own website lists 2026 hours (viewed
2026-10-03)" or "James Beard America's Classics 2024 winner; official site shows current
menu". Vague answers ("popular local spot", "well reviewed") are not evidence.

**`what_to_order`** — only items the source page itself mentions. Do not add a signature
dish from memory.

## Lessons from the first three regions (read these — each was a real mistake)

- **Label your own advice.** A `note` shows a "Source" link beside it, so every sentence in
  it reads as the source's claim. Keep the sourced FACT ("the NPS says the in-park
  restaurant is closed") and put your inference in a separate sentence that begins
  "Our advice:" or "Our read:" ("Our advice: pack lunch for trail days"). Advice that
  follows from a sourced fact is welcome — attributing it to the source is not.
- **Never map a day to `null` just because it is spent inside a park.** Nobody eats on a
  trail, but they still eat. Map in-park days to the gateway town where meals actually
  happen, and use that stop's `note` (with an NPS source) to say dining inside is thin.
  `null` is for days with no meal question at all — "Depart", or a pure travel day.
- **If an eat is in a neighbouring town, say so at the start of `why`** ("In the
  neighbouring town of Tropic rather than Bryce Canyon City itself."). A traveller scans
  for the stop's town and must not look in the wrong place.
- **Prefer pages that carry a year** — a copyright footer, a dated event, "open for the 2026
  season". A page with hours but no year is weak evidence, since abandoned sites stay up
  with stale hours. If that is all you have, say so in `open_evidence` ("the page shows no
  year") and prefer a stronger alternative if one exists.
- **Check seasonal places against today's date** and state the dates in `hours_note`. A
  lobster pound whose last day is nine days away is the single most useful fact on the card.
- **Keep reputation out of `open_evidence`.** No rankings, no "best of", no review-site
  scores. It must say what you saw that shows the place is operating.
- **Mixed sources are fine if the text says so** ("Per Visit Utah, ..."), but a claim should
  rest on a page you fetched, and the card's own `source_url` should be the page that
  backs most of it.

## What counts as an acceptable source

Use WebFetch against first-party or authoritative pages:

- the venue's **own website** (best — shows current hours and menu)
- the **James Beard Foundation** (jamesbeard.org) — America's Classics honours locally
  owned restaurants open at least a decade, chosen by an expert committee; a strong test
  that a place is a durable institution
- a **state or city tourism board**, or a **chamber of commerce** page
- **National Park Service** (nps.gov) concession and dining pages — ideal for in-park food
- a **local newspaper or regional magazine** feature published in 2024 or later

**Not acceptable, and a mechanical validator will reject the whole record:** Wikipedia,
Yelp, TripAdvisor, Google Maps, Foursquare, OpenTable, Reddit, Facebook, Instagram, Lonely
Planet, and generic "best road trip food" listicles (Cheapism, Food Network, Lovefood,
Roadtrippers). Social pages are excluded because a page's existence proves nothing about
whether the place is open — plenty are abandoned years ago.

## Selection rules

- **Locally owned.** No national chains. A local group of up to three locations is fine.
- **Prefer institutions** — places open ten years or more — over this year's opening. They
  are more likely to still be there when the traveller arrives.
- **Be honest about thin towns.** If a town has two verified places, list two and say so
  in `note`. Do not pad to three.
- **Variety over volume.** Different meals, different kinds. Not three BBQ joints.
- **Don't send people far off-route.** Every eat should be in or immediately by the stop's
  town, or on the way in.
- **No fine-dining reservations-required destinations** unless that is genuinely the
  region's draw; this is road food.

## Budget

Roughly 10 web searches and ~40 tool calls total. Don't chase one place through more than
two dead ends — drop it and move on. If search is unavailable, WebFetch official domains
directly.

**Write the JSON file BEFORE you write your report back.** An earlier run in this project
did all the work and then died composing its summary, losing everything.

## Report back (briefly)

The path you wrote; any stop where you found fewer than two verified eats and why; any
place you dropped because you could not confirm it is operating; and anything in your
output you are less than confident about. Say plainly which claims rest on a source you
actually fetched versus a search-result snippet.
