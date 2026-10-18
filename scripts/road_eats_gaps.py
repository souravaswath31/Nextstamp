#!/usr/bin/env python3
"""Show what a region already has and which of its days still have no eat town.

    python3 scripts/road_eats_gaps.py <region_key>      # e.g. vermont, route:bali-indonesia

Used before an EXTEND pass (validate_road_eats.py --extend): the researcher adds eats for the
days listed under "Unmapped days" and must not repeat what is under "Already have".
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from validate_road_eats import ITINERARIES_PATH, SEED_PATH, itinerary_index, region_itineraries  # noqa: E402


def main():
    if len(sys.argv) != 2:
        print(__doc__)
        return 1
    rk = sys.argv[1]
    seed = json.loads(SEED_PATH.read_text())
    reg = next((r for r in seed if r["region_key"] == rk), None)
    idx = itinerary_index()
    its = region_itineraries(rk, idx)
    print(f"# Gaps: {rk}\n")
    if reg is None:
        print("(no region yet: use the normal new-region flow)")
    else:
        print("## Already have (do not repeat)")
        for s in reg["stops"]:
            print(f"- {s['town']}: " + "; ".join(e["name"] for e in s["eats"]))
    print("\n## Unmapped days (give each a town, or leave null if a meal question truly does not arise)")
    n = 0
    for it in its:
        for d in it["days"]:
            if not d.get("eat_town"):
                n += 1
                print(f"- {it['title']} | day {d['day_number']}: {d['title']}")
                if d.get("lodging_suggestion"):
                    print(f"    sleeping in: {d['lodging_suggestion']}")
                print(f"    activities: {' | '.join(d.get('activities') or [])[:240]}")
    print(f"\n{n} unmapped day(s).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
