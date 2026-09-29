#!/usr/bin/env python3
"""Geocode itinerary day stops and country reference cities, once, into the seed data.

    python3 scripts/geocode_itineraries.py              # everything missing
    python3 scripts/geocode_itineraries.py --countries  # just country reference cities
    python3 scripts/geocode_itineraries.py --recheck
    python3 scripts/geocode_itineraries.py --dry-run

Companion to geocode_places.py, which does state-guide places. Same rules:
authoring time only (Nominatim allows 1 req/sec and forbids autocomplete),
curl rather than urllib (~0.4s vs ~45s per request), and anything that can't be
resolved confidently is left null rather than approximated.

WHAT MAKES ITINERARY DAYS HARDER THAN PLACES
A day's title is often not a place at all — "Arrive and acclimatise", "Drive
day", "Rest and laundry". Those must come back null, not be pinned to whatever
Nominatim's first guess is. Two defences:

  * Every lookup is constrained with Nominatim's `countrycodes` parameter to
    the itinerary's own country, so a query can't wander to another continent.
  * Titles that are obviously not locations are skipped before any request,
    both to save the rate-limited call and to avoid a lucky-but-wrong match.

Domestic itineraries are additionally bounded to their related state's box
(reused from geocode_places.py), because `countrycodes=us` still leaves room to
land 2,000 miles from the trip.
"""

import argparse
import json
import re
import subprocess
import sys
import time
import urllib.parse
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from geocode_places import STATE_BOUNDS, in_bounds, NOMINATIM, USER_AGENT, RATE_LIMIT_SECONDS

REPO_ROOT = Path(__file__).resolve().parent.parent
ITINERARIES_PATH = REPO_ROOT / "data" / "itineraries-seed.json"
COUNTRY_FACTS_PATH = REPO_ROOT / "data" / "country-facts-seed.json"

# Day titles that are activities, not places. Checked as whole-title patterns
# and as leading verbs — a title starting "Fly to Osaka" IS a place, one that
# is only "Fly home" is not.
NON_PLACE_PATTERNS = [
    r"^(arrive|arrival|depart|departure|fly home|flight home|travel home|head home)\b.*$",
    r"^(rest|recovery|free|buffer|spare|flex|laundry|packing|pack)\b",
    r"^(drive day|transit day|travel day|repositioning)\b",
    r"^(acclimatis|acclimatiz)",
    r"^(optional|choose your own|your call|down ?day)\b",
    r"^day \d+$",
]

# Strip framing that hurts a geocoder: "Day 3: Moab" -> "Moab",
# "Moab & Arches NP" -> "Moab", "Explore Kyoto" -> "Kyoto".
LEADING_NOISE = re.compile(
    r"^(day\s*\d+\s*[:\-–]\s*|explore\s+|discover\s+|into\s+|onward to\s+|on to\s+|"
    r"north to\s+|south to\s+|east to\s+|west to\s+|drive to\s+|fly to\s+|train to\s+)",
    re.IGNORECASE,
)


def clean_title(title):
    t = title.strip()
    t = LEADING_NOISE.sub("", t)
    # Split A→B legs first and keep the origin. "Seward → Denali" is a day that
    # STARTS at Seward; querying the whole string made Nominatim return
    # Anchorage, which is neither end of the leg.
    t = re.split(r"\s*(?:→|->|—>|➔|>)\s*", t)[0].strip()
    # Then the first segment of a compound title — the anchor place.
    t = re.split(r"\s*[&+]\s*|\s+and\s+|\s*[,–—]\s*|\s*\(", t)[0].strip()
    t = re.sub(r"\s*\([^)]*\)", "", t).strip()
    # Trailing filler that turns a place into a phrase: "Ubud jungle",
    # "Dubai leisure", "NOLA food". The place is the part before it.
    t = re.sub(
        # "beaches" is deliberately NOT here: it's part of real place names
        # ("Black sand beaches") more often than it's filler, and stripping it
        # turned a working match into the meaningless query "Black sand". The
        # outlier check is the safety net, so this list can afford to be
        # conservative.
        r"\s+(day trip|full day|leisure|exploration|food|eats|dining|nightlife|"
        r"shopping|jungle|highlights?|sightseeing|departure|arrival)$",
        "",
        t,
        flags=re.IGNORECASE,
    ).strip()
    return t


# A generic word on its own ("Waterfalls", "Temples") will match *something*
# almost anywhere. Constrained to a country that's fine for Monaco and useless
# for Indonesia — "Waterfalls" in a Bali itinerary resolved to North Sulawesi,
# 2,000km away. These are only rejected when they're the ENTIRE cleaned title;
# "Waimea Canyon" and "Black sand beaches" still resolve normally.
GENERIC_ALONE = {
    "waterfalls", "waterfall", "temples", "temple", "beaches", "beach", "markets",
    "market", "safari", "desert safari", "hot springs", "the coast", "coast",
    "old town", "downtown", "the beach", "national park", "the island", "island",
    "mountains", "the mountains", "lakes", "the lake", "ruins", "the ruins",
    "city centre", "city center", "old city", "the falls", "falls", "caves", "cave",
}

# A stop is suspect when it is isolated — far from EVERY other stop on the
# trip — not when it is far from the trip's centre. That distinction matters:
# "Seattle → Denver: Rainier to the Rockies" legitimately spans ~1,600km, so a
# distance-from-the-middle rule rejects perfectly good stops on any long road
# trip. A bad match, by contrast, has no neighbours at all.
MAX_KM_TO_NEAREST_STOP = 1000.0


def haversine_km(a_lat, a_lon, b_lat, b_lon):
    from math import radians, sin, cos, asin, sqrt

    dlat = radians(b_lat - a_lat)
    dlon = radians(b_lon - a_lon)
    h = sin(dlat / 2) ** 2 + cos(radians(a_lat)) * cos(radians(b_lat)) * sin(dlon / 2) ** 2
    return 2 * 6371.0 * asin(sqrt(h))


def median(values):
    s = sorted(values)
    n = len(s)
    return s[n // 2] if n % 2 else (s[n // 2 - 1] + s[n // 2]) / 2


def reject_outliers(day_hits):
    """
    Drop stops that are geographically isolated from every other stop.

    Isolation, not distance-from-centre. A cross-country road trip's stops
    chain together — each has a neighbour a few hundred km away even when the
    two ends are 1,600km apart — whereas a mis-geocoded stop sits alone.
    Measuring from the centre punishes the long trip and misses nothing the
    nearest-neighbour test doesn't already catch.

    Needs at least three stops to have an opinion: with two, there is no way to
    tell which of them is the wrong one.

    NOTE this cannot catch a *systematically* wrong set — if every stop is
    mis-resolved into the same wrong region they all have close neighbours and
    all look fine. That failure mode is prevented upstream instead, by not
    forcing a multi-state itinerary into one state's bounding box.
    """
    if len(day_hits) < 3:
        return day_hits, []

    kept, dropped = [], []
    for i, hit in enumerate(day_hits):
        nearest = min(
            haversine_km(hit[1], hit[2], other[1], other[2])
            for j, other in enumerate(day_hits)
            if j != i
        )
        if nearest > MAX_KM_TO_NEAREST_STOP:
            dropped.append(hit)
        else:
            kept.append(hit)
    return kept, dropped


def looks_like_place(title):
    t = title.strip().lower()
    for pat in NON_PLACE_PATTERNS:
        if re.search(pat, t):
            return False
    # A title with no letters, or a single very short token, isn't worth a call.
    cleaned = clean_title(title)
    if len(cleaned) < 3 or not re.search(r"[a-z]", cleaned, re.I):
        return False
    # A bare generic noun will match somewhere, and somewhere is not good enough.
    if cleaned.lower() in GENERIC_ALONE:
        return False
    return True


def nominatim(query, country_codes=None):
    # Ask for several candidates rather than one. Nominatim's top hit for
    # "Yellowstone" is Yellowstone *County*, Montana — an administrative area
    # whose centre is near Billings, ~180km from the national park anyone
    # naming a day "Yellowstone" means. Counties, states and districts are
    # almost never what an itinerary day refers to, so they're ranked last.
    params = {"q": query, "format": "json", "limit": "5", "addressdetails": "0"}
    if country_codes:
        params["countrycodes"] = country_codes
    url = f"{NOMINATIM}?{urllib.parse.urlencode(params)}"
    try:
        proc = subprocess.run(
            ["curl", "-s", "-4", "--max-time", "20", "-A", USER_AGENT, url],
            capture_output=True, text=True, timeout=30,
        )
        if proc.returncode != 0 or not proc.stdout.strip():
            return None
        data = json.loads(proc.stdout)
    except Exception as e:
        print(f"      ! {e}", file=sys.stderr)
        return None
    if not data:
        return None

    def rank(hit):
        # Lower sorts first. Nominatim's own ordering is preserved within each
        # band by the index, so this only demotes, never reshuffles arbitrarily.
        t = (hit.get("type") or "").lower()
        cls = (hit.get("class") or "").lower()
        if t in ("administrative", "county", "state", "region", "district", "province"):
            return 2
        # A populated place or a named feature is what a day title usually means.
        if cls in ("place", "boundary", "natural", "leisure", "tourism", "waterway"):
            return 0
        return 1

    best = min(range(len(data)), key=lambda i: (rank(data[i]), i))
    hit = data[best]
    try:
        return float(hit["lat"]), float(hit["lon"]), hit.get("display_name", "")
    except (KeyError, ValueError):
        return None


def geocode_best(query, country_codes=None):
    """
    nominatim(), plus a retry for the case where the only match is a county.

    "Yellowstone" returns exactly one result — Yellowstone County, Montana,
    centred near Billings, ~180km from the park a day titled "Yellowstone"
    obviously means. There is nothing better in the result set to rank above
    it, so ranking can't fix this; the query has to change. Appending the
    feature qualifier resolves it to the park (44.62, -110.56), and the same
    holds for Glacier.

    Only fires when the first answer was administrative, so it costs one extra
    request on a small minority of lookups.
    """
    first = nominatim(query, country_codes)
    if first is None:
        return None
    # Heuristic for "we got a county/state, not a place": the display name
    # starts with the thing we asked for and then says County/Parish/Borough.
    label = first[2].lower()
    if not re.search(r"\b(county|parish|borough|district|province|prefecture)\b", label):
        return first

    # The qualifier belongs on the PLACE, not the end of the whole query.
    # Queries arrive as "Yellowstone, USA"; naive appending produced
    # "Yellowstone, USA National Park", which matches nothing and silently left
    # the county in place.
    head, sep, tail = query.partition(",")
    for qualifier in (" National Park", " National Monument"):
        time.sleep(RATE_LIMIT_SECONDS)
        retry = nominatim(f"{head}{qualifier}{sep}{tail}", country_codes)
        if retry and not re.search(
            r"\b(county|parish|borough|district|province|prefecture)\b", retry[2].lower()
        ):
            return retry
    return first


def load_iso2_map():
    """Country name -> ISO2, from the researched country-facts data set."""
    if not COUNTRY_FACTS_PATH.exists():
        return {}
    facts = json.loads(COUNTRY_FACTS_PATH.read_text())
    m = {f["country"].lower(): f["iso2"].lower() for f in facts if f.get("iso2")}
    # Names that appear in itineraries but not as a country-facts row.
    m.setdefault("usa", "us")
    m.setdefault("united states", "us")
    return m


def geocode_countries(facts, args):
    """Reference cities for the country guides — the easy half."""
    resolved = failed = skipped = 0
    for fact in facts:
        if fact.get("latitude") is not None and not args.recheck:
            skipped += 1
            continue
        city = fact.get("climate_reference_city")
        iso2 = (fact.get("iso2") or "").lower()
        if not city or not iso2:
            fact["latitude"] = fact["longitude"] = None
            failed += 1
            print(f"  --   {fact['country']}: no reference city on file")
            continue

        # Reference cities often carry a clarifying parenthetical or a comma'd
        # qualifier ("Colombo (west and southwest coast)") that is useful to a
        # reader and useless to a geocoder.
        city_q = re.sub(r"\s*\([^)]*\)", "", city).split(",")[0].strip()

        time.sleep(RATE_LIMIT_SECONDS)
        hit = nominatim(f"{city_q}, {fact['country']}", country_codes=iso2)
        if not hit:
            fact["latitude"] = fact["longitude"] = None
            failed += 1
            print(f"  --   {fact['country']} ({city})")
            continue
        lat, lon, _ = hit
        fact["latitude"] = round(lat, 6)
        fact["longitude"] = round(lon, 6)
        resolved += 1
        print(f"  ok   {fact['country']:14} {city_q:18} ({lat:.4f}, {lon:.4f})")
        if not args.dry_run:
            COUNTRY_FACTS_PATH.write_text(json.dumps(facts, indent=2, ensure_ascii=False) + "\n")
    return resolved, failed, skipped


def geocode_itineraries(itineraries, iso2_map, args):
    resolved = failed = skipped = not_a_place = outliers = 0

    for it in itineraries:
        countries = [c.strip() for c in it.get("countries", []) if c.strip()]
        primary = countries[0] if countries else None
        iso2 = iso2_map.get((primary or "").lower())
        related = it.get("related_states") or []
        # Only constrain to a state when the itinerary is genuinely in ONE
        # state. Taking related[0] of a multi-state route forced every day into
        # the first state's box: "Seattle → Denver" pinned Glacier, Red Lodge
        # and Yellowstone to points in Washington, and because they all agreed
        # with each other the isolation check couldn't see anything wrong. For
        # a multi-state route, query the place plainly and let Nominatim's own
        # ranking pick the famous one.
        state_slug = related[0] if len(related) == 1 else None

        print(f"\n{it['title'][:62]}")
        day_hits = []  # (day, lat, lon, label) — collected, then outlier-checked
        for day in it.get("days", []):
            if day.get("latitude") is not None and not args.recheck:
                skipped += 1
                continue
            if not looks_like_place(day.get("title", "")):
                day["latitude"] = day["longitude"] = None
                not_a_place += 1
                continue

            q_place = clean_title(day["title"])
            # Bias the query toward the right region before falling back wider.
            queries = []
            if state_slug:
                queries.append(f"{q_place}, {state_slug.replace('-', ' ')}, USA")
            if primary:
                queries.append(f"{q_place}, {primary}")
            queries.append(q_place)

            hit = None
            for q in queries:
                time.sleep(RATE_LIMIT_SECONDS)
                r = geocode_best(q, country_codes=iso2)
                if not r:
                    continue
                lat, lon, _ = r
                # Domestic: countrycodes=us isn't tight enough on its own.
                if state_slug and state_slug in STATE_BOUNDS and not in_bounds(lat, lon, state_slug):
                    continue
                hit = (lat, lon)
                break

            if hit:
                day_hits.append((day, hit[0], hit[1], q_place))
            else:
                day["latitude"] = day["longitude"] = None
                failed += 1
                print(f"  --   d{day.get('day_number','?'):<2} {q_place[:40]}")

        # Only now, with the whole itinerary's stops in hand, can a stop be
        # judged against its neighbours. One bad match is obvious in company
        # and invisible on its own.
        kept, dropped = reject_outliers(day_hits)

        for day, lat, lon, label in kept:
            day["latitude"], day["longitude"] = round(lat, 6), round(lon, 6)
            resolved += 1
            print(f"  ok   d{day.get('day_number','?'):<2} {label[:40]:42} ({lat:.3f}, {lon:.3f})")

        for day, lat, lon, label in dropped:
            day["latitude"] = day["longitude"] = None
            outliers += 1
            print(
                f"  XX   d{day.get('day_number','?'):<2} {label[:40]:42} "
                f"({lat:.3f}, {lon:.3f}) — too far from the rest of this trip, dropped"
            )

        if not args.dry_run and (kept or dropped):
            ITINERARIES_PATH.write_text(
                json.dumps(itineraries, indent=2, ensure_ascii=False) + "\n"
            )

    return resolved, failed, skipped, not_a_place, outliers


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--countries", action="store_true", help="only country reference cities")
    ap.add_argument("--itineraries", action="store_true", help="only itinerary days")
    ap.add_argument("--recheck", action="store_true")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    do_countries = args.countries or not args.itineraries
    do_itineraries = args.itineraries or not args.countries

    if do_countries and COUNTRY_FACTS_PATH.exists():
        print("=== country reference cities ===")
        facts = json.loads(COUNTRY_FACTS_PATH.read_text())
        r, f, s = geocode_countries(facts, args)
        print(f"\n{r} resolved, {f} unresolved, {s} already had coordinates.")

    if do_itineraries:
        print("\n=== itinerary day stops ===")
        itineraries = json.loads(ITINERARIES_PATH.read_text())
        r, f, s, n, o = geocode_itineraries(itineraries, load_iso2_map(), args)
        print(
            f"\n{r} resolved, {f} unresolved, {o} dropped as geographic outliers, "
            f"{n} titles that aren't places (skipped without a request), "
            f"{s} already had coordinates."
        )

    if args.dry_run:
        print("\nDry run — nothing written.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
