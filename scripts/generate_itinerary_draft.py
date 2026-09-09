"""
Itinerary draft generator.

We have 50 state guides (840 researched places across amazing/common/hidden/
food_culture) but only 5 states have an actual day-by-day Itinerary built
from that material. Writing each one by hand the way the state guides were
written would mean re-researching content we already have. This script
does the mechanical assembly instead — selection, town-clustering, day
structuring, category/cost-tier inference, title drafting — from data
that's already sourced and verified.

What it deliberately does NOT do: invent drive times or geographic
sequencing. There's no lat/long in the place data, so the script clusters
places by their existing `nearest_town` field but leaves town ORDER as
`None` for a human (or an agent with real geographic knowledge) to set
before this becomes a finished itinerary. Fabricating "2.5 hrs" between
two towns with no distance data would be exactly the kind of invented
fact this whole project has avoided everywhere else.

Usage:
    python3 generate_itinerary_draft.py <state-slug> [--days 7]

Output: a draft dict printed as JSON, matching the itineraries-seed.json
shape minus town ordering and drive times — meant to be reviewed, ordered,
and lightly hand-finished before being appended to the real seed file.
"""

import json
import sys
import argparse
from collections import OrderedDict

STATE_GUIDES_PATH = "/home/claude/nextstamp-app/data/state-guides-seed.json"

# Maps a place's place_type to an itinerary-level category tag. This is a
# different vocabulary than the state guide's own category field (amazing/
# common/hidden/food_culture) — these are the tags the Itinerary model and
# Explore page filters actually use.
PLACE_TYPE_TO_ITIN_CATEGORY = {
    "hike": "nature",
    "park": "nature",
    "drive": "road-trip",
    "attraction": "city",
    "town": "city",
}


def load_state(slug):
    with open(STATE_GUIDES_PATH) as f:
        states = json.load(f)
    match = next((s for s in states if s["slug"] == slug), None)
    if not match:
        raise ValueError(f"No state guide found for slug '{slug}'")
    return match


def select_places(state, target_stops=9):
    """Pick a balanced set of stops: all 'amazing' places (the curated
    adventure highlights), the top few 'common' places (so it still hits
    the must-sees), and one 'hidden' gem for local flavor — not a random
    sample, a deliberate mix matching how the existing hand-built
    itineraries are shaped."""
    by_cat = {"amazing": [], "common": [], "hidden": []}
    for p in state["places"]:
        if p["category"] in by_cat:
            by_cat[p["category"]].append(p)

    selected = list(by_cat["amazing"])
    remaining = target_stops - len(selected)
    selected += by_cat["common"][: max(0, min(remaining, 3))]
    remaining = target_stops - len(selected)
    selected += by_cat["hidden"][: max(0, min(remaining, 1))]
    return selected[:target_stops]


def cluster_by_town(places):
    """Groups selected places by nearest_town. Order of clusters here is
    just first-appearance order — NOT a claim about geographic sequence.
    A human pass re-orders these before the itinerary is finalized."""
    clusters = OrderedDict()
    for p in places:
        town = p.get("nearest_town") or "Unspecified"
        clusters.setdefault(town, []).append(p)
    return clusters


def infer_categories(places):
    tags = set()
    for p in places:
        tag = PLACE_TYPE_TO_ITIN_CATEGORY.get(p.get("place_type"))
        if tag:
            tags.add(tag)
    hidden_count = sum(1 for p in places if p["category"] == "hidden")
    if hidden_count >= 2:
        tags.add("off-the-beaten-path")
    if not tags:
        tags.add("nature")
    return sorted(tags)


def activity_label(place):
    """Short bullet-style activity text matching the existing itineraries'
    voice (e.g. 'Turnagain Arm scenic drive', 'Glacier boat tour') rather
    than restating the place's full description."""
    type_suffix = {
        "hike": "hike",
        "drive": "scenic drive",
        "park": "visit",
        "attraction": "stop",
        "town": "wander",
    }.get(place.get("place_type"), "visit")
    return f"{place['name']} — {type_suffix}"


def build_days(town_clusters):
    days = []
    day_num = 1
    for town, places in town_clusters.items():
        # Split a town's places across at most 2 activities/day so no
        # single day is overloaded, matching the pacing of hand-built
        # itineraries.
        for i in range(0, len(places), 2):
            chunk = places[i : i + 2]
            days.append(
                {
                    "day_number": day_num,
                    "title": town if town != "Unspecified" else chunk[0]["name"],
                    "activities": [activity_label(p) for p in chunk],
                    "drive_time": None,  # left for human/geographic review
                    "lodging_suggestion": town if town != "Unspecified" else None,
                    "coffee_wifi_spot": None,
                    "_tips": [p["tip"] for p in chunk if p.get("tip")],
                }
            )
            day_num += 1
    return days


def draft_title(state, town_order):
    towns = [t for t in town_order if t != "Unspecified"]
    if len(towns) >= 2:
        route = " → ".join(towns[:4])
        return f"{state['name']}: {route}"
    return f"{state['name']} Highlights"


def generate_itinerary_draft(state_slug, target_stops=9):
    state = load_state(state_slug)
    places = select_places(state, target_stops=target_stops)
    town_clusters = cluster_by_town(places)
    days = build_days(town_clusters)

    draft = {
        "title": draft_title(state, list(town_clusters.keys())),
        "category": infer_categories(places),
        "region": f"Domestic USA · {state['region']}",
        "countries": ["USA"],
        "duration_days_min": len(days),
        "duration_days_max": len(days) + 2,
        "best_time_description": state["best_time_to_visit"],
        "best_time_months": [],  # fill in after reading best_time_description
        "description": f"DRAFT — derived from the {state['name']} state guide. {state['hero_tagline']}.",
        "cost_tier": "mid",
        "related_states": [state_slug],
        "days": days,
        "_source": "generated",
        "_review_needed": [
            "Confirm/reorder town sequence geographically",
            "Add real drive_time between towns if known",
            "Trim description to itinerary voice (currently a placeholder)",
            "Spot-check duration_days_min/max against actual pacing",
        ],
    }
    return draft


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("state_slug")
    parser.add_argument("--stops", type=int, default=9)
    args = parser.parse_args()
    draft = generate_itinerary_draft(args.state_slug, target_stops=args.stops)
    print(json.dumps(draft, indent=2))
