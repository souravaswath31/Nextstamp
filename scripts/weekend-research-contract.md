# Research contract: weekend routes (3 days, USA)

Handed to every agent that writes a weekend route for the Escape Hatch game. Read the "never fabricate a
fact" section of `CLAUDE.md` first. **There is no human review after you.** The validators check
structure and sourcing presence only. If you cannot verify something from an authoritative page you opened,
leave it out or soften it ("check the operator's timetable"). Never present memory as sourced.

Run `date +%F` for today's date.

## The job
Write ONE itinerary: a real 3-day getaway from a big US metro, for a group of friends with a long weekend
(Friday evening or Saturday morning to Sunday night). It becomes one card in a game, so it must read well
in three short days and be easy to picture.

You are given: the metro it serves, a destination hint, and the state slug(s). The hint is a starting point.
You may pick a more coherent route in the same area. Do **not** reuse a title already in
`data/itineraries-seed.json` (check with
`python3 -c "import json;print([x['title'] for x in json.load(open('data/itineraries-seed.json'))])"`),
and do not duplicate the area of an existing itinerary in the same state: choose a different corner or theme.

## Shape
Print an existing 3-day domestic one as the model:
`python3 -c "import json; print(json.dumps([x for x in json.load(open('data/itineraries-seed.json')) if x['title']=='Hocking Hills, Ohio'][0], indent=2))"`

Required, and enforced by `scripts/validate_itineraries.py`:
- `region`: `"Domestic USA"`; `countries`: `["USA"]`; `related_states`: the state slug(s) you were given
  (valid slugs only; see `data/state-guides-seed.json`). **No** `food_culture`.
- `days`: exactly 3, numbered 1 to 3. Day 1 is arrival (a light evening is fine), day 2 is the full day,
  day 3 is a morning plus the way home. Each day has a `title` (the place or the move, e.g. "Beacon: Dia and
  Main Street"), `activities` (2 to 4 short strings, each a real thing at a real place that exists today),
  `lodging_suggestion` (a town, not a hotel brand), and `drive_time`.
- `duration_days_min` 3, `duration_days_max` 3 or 4. `category` only from: nature, city, water, splurge,
  budget, road-trip, off-the-beaten-path. `cost_tier` from budget, mid, splurge (what two nights, food and
  activities cost per person, excluding the trip to get there: roughly budget under $150/day,
  mid $150-350/day, splurge above). `best_time_months`: real month names when the trip is at its best.
- `description`: one or two plain sentences saying what the weekend is and who it suits. Do not state
  the distance or drive time from the metro unless an official source gives it.
- **No latitude/longitude** on days (they are geocoded later). Set `cover_image_url` to `null`.
  Do not set `eat_town`.

## Facts: what you may and may not say
- Drive or transit times between stops: only from an official page or an operator timetable you opened.
  Otherwise write `drive_time` as `null` and use words like "short drive" only if it is obviously true
  (same town). Never invent minutes.
- Opening days, seasons, timed entry, reservations, permits: state them only if you found them on the venue's
  or park's own page, and say so in the activity ("closed Mondays", "timed tickets required"). A trail, park or
  museum that is seasonal gets its season in the text.
- No prices. No claims like "best in the state". No restaurants named unless you opened the venue's own
  page and it shows it is operating now (most weekend routes can leave food to the eat-stop data later).
- Sources: official only (the park, town, state tourism office, operator, museum). Rejected sites:
  wikipedia, wikivoyage, tripadvisor, reddit, lonelyplanet, yelp, listicles and aggregators.

## Budget
About 10 WebSearch calls and 40 tool calls. Write the JSON file as soon as it is complete, **before** composing
your report. Write only to the path you are given and touch no repo file. If the shared web-search budget runs
out, write what you verified and say what you could not check.

## Self-check (writes nothing)
`python3 scripts/validate_itineraries.py --dry-run <your-file.json>` and fix what it reports. The file is a JSON
**array containing one object**.

## Report (under 120 words)
The path; the title; which claims came from a page you opened and which are unverified and softened.
