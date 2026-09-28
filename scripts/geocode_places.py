#!/usr/bin/env python3
"""Geocode state-guide places ONCE, at authoring time, into the seed data.

    python3 scripts/geocode_places.py                 # every place missing coords
    python3 scripts/geocode_places.py --state montana # one state
    python3 scripts/geocode_places.py --recheck       # redo even those already set
    python3 scripts/geocode_places.py --dry-run       # look up, print, write nothing

WHY AUTHORING TIME AND NOT REQUEST TIME
Nominatim's usage policy caps you at one request per second, requires a
real identifying User-Agent, and explicitly forbids using it to drive
autocomplete. Geocoding 840 places on page render would violate all three and
be unusably slow. So coordinates are resolved once here and committed into
data/state-guides-seed.json, exactly like every other fact in this project.

WHY THIS IS FUSSIER THAN A NORMAL GEOCODER
A wrong pin is worse than no pin. "Hidden gems" in particular have names that
collide with towns on the other side of the country — a naive first-hit lookup
cheerfully drops Montana's trailheads in Florida. So every result must:

  * fall inside the bounding box of the state it belongs to, and
  * come back from a query that included that state's name.

Anything that fails is left null, and null places are simply omitted from the
map. Per CLAUDE.md, a plausible-looking invented location is exactly the kind
of fabrication this project refuses — the same reason
generate_itinerary_draft.py won't compute drive times.
"""

import argparse
import json
import re
import sys
import time
import urllib.parse
import urllib.request
import subprocess
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
SEED_PATH = REPO_ROOT / "data" / "state-guides-seed.json"

NOMINATIM = "https://nominatim.openstreetmap.org/search"
# Nominatim requires a genuine identifying User-Agent with contact info.
USER_AGENT = "NextStamp/1.0 (trip planner; https://nextstamp-app.vercel.app)"
RATE_LIMIT_SECONDS = 1.1  # policy is 1/sec; leave headroom

# Generous bounding boxes per state: (min_lat, max_lat, min_lon, max_lon).
# Deliberately loose — the job here is to catch a pin landing in another
# region entirely, not to police a few miles at the border.
STATE_BOUNDS = {
    "alabama": (30.1, 35.1, -88.6, -84.8), "alaska": (51.0, 71.6, -179.9, -129.0),
    "arizona": (31.2, 37.1, -114.9, -108.9), "arkansas": (32.9, 36.6, -94.7, -89.5),
    "california": (32.4, 42.1, -124.5, -114.0), "colorado": (36.9, 41.1, -109.1, -101.9),
    "connecticut": (40.9, 42.1, -73.8, -71.7), "delaware": (38.4, 39.9, -75.8, -74.9),
    "florida": (24.3, 31.1, -87.7, -79.9), "georgia": (30.3, 35.1, -85.7, -80.7),
    "hawaii": (18.8, 22.3, -160.3, -154.7), "idaho": (41.9, 49.1, -117.3, -110.9),
    "illinois": (36.9, 42.6, -91.6, -87.4), "indiana": (37.7, 41.8, -88.2, -84.7),
    "iowa": (40.3, 43.6, -96.7, -90.1), "kansas": (36.9, 40.1, -102.1, -94.5),
    "kentucky": (36.4, 39.2, -89.6, -81.9), "louisiana": (28.8, 33.1, -94.1, -88.7),
    "maine": (42.9, 47.5, -71.2, -66.8), "maryland": (37.8, 39.8, -79.5, -74.9),
    "massachusetts": (41.2, 42.9, -73.6, -69.8), "michigan": (41.6, 48.4, -90.5, -82.3),
    "minnesota": (43.4, 49.5, -97.3, -89.4), "mississippi": (30.1, 35.1, -91.7, -88.0),
    "missouri": (35.9, 40.7, -95.9, -89.0), "montana": (44.3, 49.1, -116.1, -104.0),
    "nebraska": (39.9, 43.1, -104.1, -95.2), "nevada": (34.9, 42.1, -120.1, -113.9),
    "new-hampshire": (42.6, 45.4, -72.6, -70.6), "new-jersey": (38.8, 41.4, -75.6, -73.8),
    "new-mexico": (31.2, 37.1, -109.1, -102.9), "new-york": (40.4, 45.1, -79.8, -71.8),
    "north-carolina": (33.7, 36.6, -84.4, -75.4), "north-dakota": (45.8, 49.1, -104.1, -96.5),
    "ohio": (38.3, 42.4, -84.9, -80.4), "oklahoma": (33.6, 37.1, -103.1, -94.4),
    "oregon": (41.9, 46.4, -124.7, -116.4), "pennsylvania": (39.6, 42.4, -80.6, -74.6),
    "rhode-island": (41.1, 42.1, -71.9, -71.0), "south-carolina": (32.0, 35.3, -83.4, -78.4),
    "south-dakota": (42.4, 46.0, -104.1, -96.4), "tennessee": (34.9, 36.7, -90.4, -81.6),
    "texas": (25.8, 36.6, -106.7, -93.4), "utah": (36.9, 42.1, -114.1, -108.9),
    "vermont": (42.7, 45.1, -73.5, -71.4), "virginia": (36.5, 39.5, -83.7, -75.1),
    "washington": (45.5, 49.1, -124.9, -116.9), "west-virginia": (37.1, 40.7, -82.7, -77.6),
    "wisconsin": (42.4, 47.4, -92.9, -86.7), "wyoming": (40.9, 45.1, -111.1, -103.9),
}


def nominatim(query):
    params = urllib.parse.urlencode(
        {"q": query, "format": "json", "limit": "1", "addressdetails": "0"}
    )
    # Shelling out to curl rather than using urllib, which measured ~45s per
    # request against this host while curl measured ~0.4s for the identical
    # URL — most likely an IPv6-first connect that has to time out before
    # falling back. At 840 places that difference is the whole job: 35 hours
    # versus about half an hour. -4 forces IPv4 and makes it predictable.
    try:
        proc = subprocess.run(
            ["curl", "-s", "-4", "--max-time", "20", "-A", USER_AGENT, f"{NOMINATIM}?{params}"],
            capture_output=True,
            text=True,
            timeout=30,
        )
        if proc.returncode != 0 or not proc.stdout.strip():
            return None
        data = json.loads(proc.stdout)
    except Exception as e:
        print(f"      ! request failed: {e}", file=sys.stderr)
        return None
    if not data:
        return None
    hit = data[0]
    try:
        return float(hit["lat"]), float(hit["lon"]), hit.get("display_name", "")
    except (KeyError, ValueError):
        return None


def in_bounds(lat, lon, slug):
    box = STATE_BOUNDS.get(slug)
    if not box:
        # No box on file: refuse rather than accept blindly.
        return False
    min_lat, max_lat, min_lon, max_lon = box
    return min_lat <= lat <= max_lat and min_lon <= lon <= max_lon


def clean(text):
    # Names sometimes carry a parenthetical or a trailing qualifier that hurts
    # more than it helps as a search string.
    return re.sub(r"\s*\([^)]*\)", "", text).strip()


def geocode_place(place, state_name, slug, verbose=False):
    """Try progressively broader queries; accept only an in-state result."""
    name = clean(place["name"])
    town = place.get("nearest_town")

    queries = []
    if town:
        queries.append(f"{name}, {town}, {state_name}, USA")
    queries.append(f"{name}, {state_name}, USA")
    if town:
        # Last resort: the town itself. Better a pin on the right town than
        # none at all for a place OSM doesn't carry — flagged by the caller.
        queries.append(f"{town}, {state_name}, USA")

    for i, q in enumerate(queries):
        time.sleep(RATE_LIMIT_SECONDS)
        result = nominatim(q)
        if verbose:
            print(f"      q: {q!r} -> {'hit' if result else 'miss'}")
        if not result:
            continue
        lat, lon, display = result
        if not in_bounds(lat, lon, slug):
            if verbose:
                print(f"      rejected out-of-state hit: {display[:70]}")
            continue
        # A town-level fallback is a coarser answer; say so.
        precision = "town" if (town and i == len(queries) - 1) else "place"
        return lat, lon, precision, display
    return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--state", help="slug of a single state to process")
    ap.add_argument("--recheck", action="store_true", help="redo places that already have coords")
    ap.add_argument("--dry-run", action="store_true", help="don't write the seed file")
    ap.add_argument("--verbose", action="store_true")
    args = ap.parse_args()

    states = json.loads(SEED_PATH.read_text())
    if args.state:
        states_to_do = [s for s in states if s["slug"] == args.state]
        if not states_to_do:
            print(f"No state with slug {args.state!r}")
            return 1
    else:
        states_to_do = states

    resolved = town_level = failed = skipped = 0

    for state in states_to_do:
        slug = state["slug"]
        if slug not in STATE_BOUNDS:
            print(f"!! no bounding box for {slug} — skipping the whole state")
            continue
        print(f"\n{state['name']} ({slug})")
        for place in state["places"]:
            # food_culture rows are dishes, drinks and traditions ("Stuffies",
            # "Coffee milk", "Sailing culture") — they have no location to find,
            # and asking Nominatim for them just burns a rate-limited request
            # to get a miss. They're ~a quarter of the data set.
            if place.get("category") == "food_culture":
                place["latitude"] = None
                place["longitude"] = None
                skipped += 1
                continue

            has_coords = place.get("latitude") is not None
            if has_coords and not args.recheck:
                skipped += 1
                continue

            result = geocode_place(place, state["name"], slug, args.verbose)
            if result is None:
                place["latitude"] = None
                place["longitude"] = None
                place["geocode_precision"] = None
                failed += 1
                print(f"  --   {place['name'][:58]}")
                continue

            lat, lon, precision, display = result
            place["latitude"] = round(lat, 6)
            place["longitude"] = round(lon, 6)
            place["geocode_precision"] = precision
            if precision == "town":
                town_level += 1
                print(f"  ~town {place['name'][:52]}  ({lat:.4f}, {lon:.4f})")
            else:
                resolved += 1
                print(f"  ok   {place['name'][:52]}  ({lat:.4f}, {lon:.4f})")

            if not args.dry_run:
                # Write after every place: this run takes ~20 minutes and
                # losing it to one network blip would be miserable.
                SEED_PATH.write_text(json.dumps(states, indent=2, ensure_ascii=False) + "\n")

    total = resolved + town_level + failed
    print(
        f"\nDone. {resolved} exact, {town_level} town-level, {failed} unresolved "
        f"out of {total} attempted ({skipped} already had coordinates)."
    )
    if args.dry_run:
        print("Dry run — nothing written.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
