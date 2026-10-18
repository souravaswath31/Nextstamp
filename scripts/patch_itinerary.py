#!/usr/bin/env python3
"""Correct the text of EXISTING itineraries in place, after a fact-check.

    python3 scripts/patch_itinerary.py brief "<itinerary title>"       # the day text an agent re-checks
    python3 scripts/patch_itinerary.py apply [--dry-run] <patch.json> [more.json ...]

A patch is ONE JSON object:

    {"title": "<exact itinerary title>",
     "fields": {"description": "...", "best_time_description": "..."},        # optional
     "days": [{"day_number": 3, "title": "...", "activities": ["...", "..."],  # any subset of keys
               "drive_time": "2.5 hrs", "lodging_suggestion": "..."}]}

Only those keys are replaced. Titles, categories, countries, coordinates and `eat_town` are never
touched here (a day whose `title` changes keeps its coordinates, so change a title only when the
place stays the same). The merged itinerary goes through the full itinerary validator before
anything is written. Load the result with `npx tsx prisma/update-itinerary-days.ts`.
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from validate_itineraries import SEED_PATH, STATE_GUIDES_PATH, validate_one  # noqa: E402

DAY_KEYS = {"title", "activities", "drive_time", "lodging_suggestion", "coffee_wifi_spot"}
TOP_KEYS = {"description", "best_time_description", "best_time_months", "cost_tier", "duration_days_min", "duration_days_max", "food_culture"}


def load():
    return json.loads(SEED_PATH.read_text())


def brief(title):
    it = next((x for x in load() if x["title"] == title), None)
    if not it:
        print(f"No itinerary titled {title!r}.")
        return 1
    keep = {k: it.get(k) for k in ["title", "countries", "description", "best_time_description", "best_time_months", "duration_days_min", "duration_days_max", "food_culture"]}
    keep["days"] = [{k: d.get(k) for k in ["day_number", "title", "activities", "drive_time", "lodging_suggestion"]} for d in it["days"]]
    print(json.dumps(keep, indent=1, ensure_ascii=False))
    return 0


def apply(paths, dry_run):
    data = load()
    index = {x["title"]: i for i, x in enumerate(data)}
    state_slugs = {s["slug"] for s in json.loads(STATE_GUIDES_PATH.read_text())}
    ok = bad = 0
    for path in paths:
        try:
            patch = json.loads(Path(path).read_text())
        except Exception as e:
            print(f"FAIL  {path}: {e}")
            bad += 1
            continue
        title = patch.get("title")
        label = f"{title} ({Path(path).name})"
        if title not in index:
            print(f"FAIL  {label}: no such itinerary")
            bad += 1
            continue
        cur = data[index[title]]
        new = json.loads(json.dumps(cur))
        errs = []
        for k, v in (patch.get("fields") or {}).items():
            if k not in TOP_KEYS:
                errs.append(f"field {k!r} is not patchable here")
            else:
                new[k] = v
        days = {d["day_number"]: d for d in new["days"]}
        for pd in patch.get("days") or []:
            n = pd.get("day_number")
            if n not in days:
                errs.append(f"day {n} does not exist")
                continue
            for k, v in pd.items():
                if k == "day_number":
                    continue
                if k not in DAY_KEYS:
                    errs.append(f"day {n}: key {k!r} is not patchable here")
                elif k == "activities" and not (isinstance(v, list) and v and all(isinstance(a, str) and a.strip() for a in v)):
                    errs.append(f"day {n}: activities must be a non-empty list of strings")
                elif k == "activities" and any("|" in a for a in v):
                    errs.append(f"day {n}: an activity may not contain '|' (it is the storage separator)")
                else:
                    days[n][k] = v
        if not errs:
            existing_titles = {x["title"].strip().lower() for x in data} - {title.strip().lower()}
            errs = validate_one(new, existing_titles, state_slugs)
        if errs:
            bad += 1
            print(f"FAIL  {label}")
            for e in errs:
                print(f"    - {e}")
            continue
        changed_days = [d["day_number"] for d in new["days"] if d != next(c for c in cur["days"] if c["day_number"] == d["day_number"])]
        changed_top = [k for k in (patch.get("fields") or {}) if cur.get(k) != new.get(k)]
        data[index[title]] = new
        ok += 1
        print(f"ok    {label}: days {changed_days or '-'}, fields {changed_top or '-'}")
    if ok and not dry_run:
        SEED_PATH.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n")
        print(f"Wrote {SEED_PATH.name}.")
    elif dry_run:
        print("Dry run: nothing written.")
    return 1 if bad else 0


def main():
    a = sys.argv[1:]
    if not a:
        print(__doc__)
        return 1
    if a[0] == "brief" and len(a) == 2:
        return brief(a[1])
    if a[0] == "apply":
        files = [x for x in a[1:] if not x.startswith("--")]
        return apply(files, "--dry-run" in a) if files else (print(__doc__) or 1)
    print(__doc__)
    return 1


if __name__ == "__main__":
    sys.exit(main())
