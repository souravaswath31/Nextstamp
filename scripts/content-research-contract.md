# Research contract: new countries (guide + visa rules + itineraries)

Handed to every research agent that adds a destination. Read `CLAUDE.md` first,
especially "never fabricate a fact", the country-guide "Recurring gaps" list, "When two
official sources disagree", "Not every country has a six-month rule", and the timezone rule.
**There is no human review after you.** The validators check structure and sourcing
presence only. You are the only fact-check. If you cannot verify something from an
authoritative source, write `null` (or omit the rule). Never present memory as sourced.

Today's date is the real date; use it for every `last_verified_date` (YYYY-MM-DD).

## Sources
- Official only: the destination's own government (immigration, foreign ministry, tourism
  board, national met service, health ministry), plus WHO / CDC / UK FCDO / Global Affairs
  Canada / US State Dept as fallbacks when the destination's own site blocks fetches
  (say so in the field).
- **Rejected by a mechanical validator:** wikipedia.org, wikivoyage.org, ivisa.com,
  visahq.com, numbeo.com, worldstandards.eu/.com, timeanddate.com, tripadvisor.*,
  reddit.com, lonelyplanet.com. Do not cite blogs, listicles, booking sites or airlines
  for a rule.
- A `source_url` must be a page you actually opened and that actually says the thing.

## Work budget (earlier runs died to usage limits)
About 10 WebSearch calls and 40 tool calls in total per task. Don't chase a field through
more than two or three dead ends. **Write each JSON file as soon as it is complete, before
composing your report.** Write only to the paths you are given; touch no repo file.

## A. Country guide: one JSON object
Shape: copy the structure of an existing record in `data/country-facts-seed.json`
(e.g. Japan, Costa Rica, Serbia). Field rules are the "Country-guide engine" section of
CLAUDE.md. Hard requirements the validator enforces:
- `country` uses the canonical short name used in the visa rules (`"UK"`, `"USA"`,
  `"UAE"`; otherwise the common English name, e.g. `"South Korea"`, `"South Africa"`).
- `iso2`, `currency_code`, an IANA `primary_timezone`; `timezone_label` must agree with
  the IANA database, not with press reports.
- `passport_validity_rule` states the destination's real rule (many countries do not
  have a six-month rule; Schengen is "3 months beyond the intended departure, issued
  within the previous 10 years").
- `onward_ticket_required` is tri-state: true / false / null (null = could not confirm).
- Climate table: exactly 12 named months in order, with temperatures and rainfall from
  the national met service (disclose an old base period).
- Phrasebook of 12-16 phrases that must cover: hello, thank you, please, excuse me, how
  much, toilet, help.
- Emergency numbers are dialable strings. If two official sources disagree, put the
  best-supported number in the structured field, name the other in `notes`, and leave a
  life-safety field `null` if nothing official confirms it.
- Power/plugs, tipping, card acceptance, eSIM: `null` unless an official source states it.
- 15+ official source URLs overall, none banned.

Self-check (writes nothing):
`python3 scripts/validate_country_facts.py --dry-run <your-file.json>`
(it will say the country is "already in the seed" only if it is. Anything else it
prints is yours to fix.)

## B. Visa rules: a JSON array, up to 7 objects (one per passport)
Passports: India, USA, UK, Canada, Australia, Germany, Singapore, Brazil. **Omit the
passport that equals the destination** (the app treats a citizen of the destination as
"no visa needed" in code). Shape: see `data/visa-rules-seed.json`:
`passport_country, destination_country, visa_type, requires_held_document_country,
conditions_text, max_stay_days, fee_notes, source_url, last_verified_date`.
- `visa_type` is one of `visa-free`, `visa-on-arrival`, `e-visa`, `advance-visa-required`.
  A pre-travel online authorisation (ETIAS, UK ETA, Canada eTA, Korea K-ETA, Australia
  ETA) is `e-visa` and `conditions_text` must name it and say whether it is in force today.
  **Check whether each scheme has actually started**; do not state a future date as fact.
- EU/EEA citizens (German passport -> an EU country): `visa-free`, `max_stay_days` null,
  `conditions_text` says EU freedom of movement and which document is accepted.
- `conditions_text` states the real condition in plain words (stay length, onward ticket,
  passport validity) and, where the rule has a catch, the catch.
- `max_stay_days` is an integer or null; if the rule is "90 days in any 180", say that in
  the text and use 90.
- `requires_held_document_country`: null unless you find a documented cascade (for
  example "visa-free if you hold a valid US visa"). Never invent one.
- Omit a passport you genuinely cannot verify rather than guess, and say which in your report.

Self-check: `python3 scripts/validate_visa_rules.py --dry-run <your-file.json>`

## C. Itineraries: a JSON array of exactly 2 objects
Shape: print an existing international one:
`python3 -c "import json; print(json.dumps([x for x in json.load(open('data/itineraries-seed.json')) if x['title']=='Tokyo, Kyoto + Osaka, Japan'][0], indent=2))"`
- `region` is `"International"`, `countries` is a list of the real country names, **no**
  `related_states`, and a `food_culture` array of `{place_type, name, description}` where
  `place_type` is one of dish / drink / tradition / culture.
- Two *different* trips: e.g. a classic first-timer route and a different region or
  season/pace. 5-10 days each. Real, geographically coherent order. Verify transit times
  between stops (train/ferry/flight) from the operator or an official source, and state
  them as times, never as a vague "short drive".
- `category` only from: nature, city, water, splurge, budget, road-trip,
  off-the-beaten-path. `cost_tier` from: budget, mid, splurge. `best_time_months` real
  month names, consistent with the climate in your country guide.
- **Do not include latitude/longitude** on days (they are geocoded later at authoring time).
  Set `cover_image_url` to null.
- Activities are things a person does at real places that exist today. No invented
  opening times, prices or claims. A closure or seasonal restriction you find must be
  in the text ("closed Mondays", "timed entry required").
- If a place needs a permit, ticket or reservation made in advance, say so in the activity.

Self-check: `python3 scripts/validate_itineraries.py --dry-run <your-file.json>`

## Report (under 150 words)
Paths written; which fields you left `null` and why; any passport you omitted and why;
anything not directly attributable to a source you cite.
