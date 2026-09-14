#!/usr/bin/env python3
"""
Itinerary content pipeline — automated gate for new itineraries before they
merge into data/itineraries-seed.json. No human read-through is required for
an itinerary to pass; this script is the entire safety net, so it checks
everything that can be checked mechanically:

  - required fields present, right types
  - category / cost_tier values are in the canonical taxonomy (src/lib/types.ts)
  - domestic itineraries (related_states set) never carry food_culture, and
    every related_states slug actually exists in the state guide data
  - international itineraries (no related_states) have region "Domestic USA"'s
    counterpart set correctly (region != "Domestic USA", countries != ["USA"])
  - no duplicate title against existing content (case-insensitive)
  - day count in a sane range, days numbered 1..N with no gaps, every day has
    a non-empty title and at least one activity
  - best_time_months are real month names

A rule that fails any check is rejected and left out — never patched or
guessed into shape. This is a mechanical gate, not a geographic-plausibility
reviewer: it cannot catch "Yellowstone and Glacier in the same week," so the
research step (whatever generates the candidate JSON) is still the one place
that has to get the facts right the first time.

Usage:
    python3 scripts/validate_itineraries.py <candidates.json>

Prints a per-itinerary pass/fail report, then (if any passed) appends the
passing ones to data/itineraries-seed.json and exits 0. Exits 1 if the
candidates file itself is malformed enough that nothing could be checked.
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SEED_PATH = ROOT / "data" / "itineraries-seed.json"
STATE_GUIDES_PATH = ROOT / "data" / "state-guides-seed.json"

# Keep in sync with src/lib/types.ts CATEGORY_LABELS keys.
ALLOWED_CATEGORIES = {
    "nature", "city", "water", "splurge", "budget", "road-trip", "off-the-beaten-path",
}
ALLOWED_COST_TIERS = {"budget", "mid", "splurge"}
ALLOWED_MONTHS = {
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
}
MIN_DAYS, MAX_DAYS = 3, 8


def fail(reasons, msg):
    reasons.append(msg)


def validate_one(it, existing_titles, state_slugs):
    reasons = []

    required = [
        "title", "category", "region", "countries", "duration_days_min",
        "duration_days_max", "best_time_description", "best_time_months",
        "description", "cost_tier", "days",
    ]
    for field in required:
        if field not in it:
            fail(reasons, f"missing required field '{field}'")
    if reasons:
        return reasons  # can't check much more without the basics

    if it["title"].strip().lower() in existing_titles:
        fail(reasons, f"duplicate title (case-insensitive match against existing seed data)")

    cats = it["category"]
    if not isinstance(cats, list) or not cats:
        fail(reasons, "category must be a non-empty list")
    else:
        bad = set(cats) - ALLOWED_CATEGORIES
        if bad:
            fail(reasons, f"invalid category value(s): {sorted(bad)} — not in {sorted(ALLOWED_CATEGORIES)}")

    if it["cost_tier"] not in ALLOWED_COST_TIERS:
        fail(reasons, f"invalid cost_tier '{it['cost_tier']}' — must be one of {sorted(ALLOWED_COST_TIERS)}")

    months = it.get("best_time_months", [])
    bad_months = set(months) - ALLOWED_MONTHS
    if bad_months:
        fail(reasons, f"invalid month name(s): {sorted(bad_months)}")

    related_states = it.get("related_states")
    has_food_culture = bool(it.get("food_culture"))

    if related_states:
        if has_food_culture:
            fail(reasons, "domestic itinerary (related_states set) must NOT include food_culture — link to the state guide instead")
        for slug in related_states:
            if slug not in state_slugs:
                fail(reasons, f"related_states slug '{slug}' does not exist in state-guides-seed.json")
        if it.get("region") != "Domestic USA":
            fail(reasons, "domestic itinerary must set region to 'Domestic USA'")
        if it.get("countries") != ["USA"]:
            fail(reasons, "domestic itinerary must set countries to ['USA']")
    else:
        if it.get("region") == "Domestic USA":
            fail(reasons, "international itinerary (no related_states) should not use region 'Domestic USA'")

    days = it.get("days")
    if not isinstance(days, list) or not (MIN_DAYS <= len(days) <= MAX_DAYS):
        fail(reasons, f"days must be a list of {MIN_DAYS}-{MAX_DAYS} entries (got {len(days) if isinstance(days, list) else 'non-list'})")
    else:
        for i, day in enumerate(days, start=1):
            if day.get("day_number") != i:
                fail(reasons, f"day {i} has day_number={day.get('day_number')} (expected sequential from 1, no gaps)")
            if not day.get("title", "").strip():
                fail(reasons, f"day {i} has an empty title")
            if not day.get("activities"):
                fail(reasons, f"day {i} has no activities")

    dmin, dmax = it.get("duration_days_min"), it.get("duration_days_max")
    if not isinstance(dmin, int) or not isinstance(dmax, int) or dmin > dmax or dmin < 1:
        fail(reasons, f"duration_days_min/max invalid ({dmin}, {dmax})")

    return reasons


def main():
    if len(sys.argv) != 2:
        print("usage: python3 scripts/validate_itineraries.py <candidates.json>")
        sys.exit(1)

    candidates_path = Path(sys.argv[1])
    try:
        candidates = json.loads(candidates_path.read_text())
    except Exception as e:
        print(f"Could not parse {candidates_path}: {e}")
        sys.exit(1)

    if not isinstance(candidates, list):
        print("candidates file must contain a JSON array of itinerary objects")
        sys.exit(1)

    existing = json.loads(SEED_PATH.read_text())
    existing_titles = {it["title"].strip().lower() for it in existing}
    state_slugs = {s["slug"] for s in json.loads(STATE_GUIDES_PATH.read_text())}

    passed, rejected = [], []
    for i, it in enumerate(candidates):
        reasons = validate_one(it, existing_titles, state_slugs)
        title = it.get("title", f"<candidate #{i}>")
        if reasons:
            rejected.append((title, reasons))
            print(f"REJECTED: {title}")
            for r in reasons:
                print(f"  - {r}")
        else:
            passed.append(it)
            print(f"PASSED:   {title}")
            existing_titles.add(title.strip().lower())  # guard against dupes within this same batch

    print(f"\n{len(passed)} passed, {len(rejected)} rejected out of {len(candidates)} candidates.")

    if passed:
        merged = existing + passed
        SEED_PATH.write_text(json.dumps(merged, indent=2, ensure_ascii=False) + "\n")
        print(f"Merged {len(passed)} itineraries into {SEED_PATH.relative_to(ROOT)} ({len(existing)} -> {len(merged)}).")
        print("Run `npm run seed` to load them into the database.")

    sys.exit(0)


if __name__ == "__main__":
    main()
