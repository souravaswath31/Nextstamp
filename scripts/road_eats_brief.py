#!/usr/bin/env python3
"""Print the research brief for one region's road-eats pass.

    python3 scripts/road_eats_brief.py texas
    python3 scripts/road_eats_brief.py --all-states     # list slugs that have itineraries
    python3 scripts/road_eats_brief.py --routes         # list international route slugs
    python3 scripts/road_eats_brief.py --route tokyo-kyoto-and-osaka-japan

The brief lists every itinerary in the region and every day, with the exact
titles and day numbers the validator will match `day_map` against. Generated
rather than hand-typed so a research agent can't be handed a misspelled title
and then be rejected for using it.

Day titles are shown with each day's driveTime and lodging where present — a
long drive day is exactly when the traveller needs an eat they can plan around.
"""

import argparse
import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
ITINERARIES = REPO_ROOT / "data" / "itineraries-seed.json"
STATES = REPO_ROOT / "data" / "state-guides-seed.json"


def state_name(slug):
    for s in json.loads(STATES.read_text()):
        if s["slug"] == slug:
            return s["name"]
    return slug.replace("-", " ").title()


def itineraries_for_state(slug):
    return [it for it in json.loads(ITINERARIES.read_text()) if slug in (it.get("related_states") or [])]


def international_routes():
    """slug -> itinerary, for every itinerary with no linked state."""
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    from route_slug import itinerary_slugs

    slugs = itinerary_slugs()
    return {
        slugs[it["title"]]: it
        for it in json.loads(ITINERARIES.read_text())
        if not it.get("related_states")
    }


def render(region_key, region_label, itineraries):
    lines = [
        f"# Road-eats brief: {region_label}",
        "",
        f"`region_key` to use in your output: **{region_key}**",
        "",
        f"This region has {len(itineraries)} itinerary(ies). Your `day_map` must contain one",
        "entry for EVERY day listed below, using these titles and day numbers EXACTLY.",
        "",
    ]
    total_days = 0
    for it in itineraries:
        lines.append(f"## {it['title']}")
        lines.append(f"({len(it['days'])} days, {it['cost_tier']} budget; "
                     f"categories: {', '.join(it.get('category', []))})")
        lines.append("")
        for day in it["days"]:
            total_days += 1
            extras = []
            if day.get("drive_time"):
                extras.append(f"drive: {day['drive_time']}")
            if day.get("lodging_suggestion"):
                extras.append(f"sleeping in: {day['lodging_suggestion']}")
            tail = f"  — {'; '.join(extras)}" if extras else ""
            lines.append(f"- day_number {day['day_number']}: {day['title']}{tail}")
            acts = day.get("activities") or []
            if acts:
                lines.append(f"    activities: {' | '.join(acts)[:240]}")
        lines.append("")
    lines.append(f"Total: {total_days} days to map across {len(itineraries)} itinerary(ies).")
    return "\n".join(lines)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("slug", nargs="?", help="state slug, e.g. texas")
    ap.add_argument("--route", help="international route slug (see --routes)")
    ap.add_argument("--routes", action="store_true", help="list international route slugs")
    ap.add_argument("--all-states", action="store_true")
    args = ap.parse_args()

    if args.all_states:
        data = json.loads(ITINERARIES.read_text())
        slugs = sorted({s for it in data for s in (it.get("related_states") or [])})
        print("\n".join(slugs))
        print(f"\n{len(slugs)} states with itineraries", file=sys.stderr)
        return 0

    if args.routes:
        for slug, it in international_routes().items():
            print(f"{slug}  ({it['title']})")
        return 0

    if args.route:
        routes = international_routes()
        it = routes.get(args.route)
        if not it:
            print(f"No international route {args.route!r}; try --routes", file=sys.stderr)
            return 1
        print(render(f"route:{args.route}", it["title"], [it]))
        return 0

    if not args.slug:
        ap.print_help()
        return 1

    its = itineraries_for_state(args.slug)
    if not its:
        print(f"No itineraries linked to state {args.slug!r}", file=sys.stderr)
        return 1
    print(render(args.slug, state_name(args.slug), its))
    return 0


if __name__ == "__main__":
    sys.exit(main())
