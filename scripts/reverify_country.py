#!/usr/bin/env python3
"""Refresh the entry-critical fields of existing country guides, in place.

    python3 scripts/reverify_country.py brief "<country>"        # the fields an agent re-checks
    python3 scripts/reverify_country.py apply [--dry-run] <patch.json> [more.json ...]

A patch is ONE JSON object:

    {"country": "Japan", "last_verified_date": "2026-10-17",
     "fields": { ...only the fields that were re-checked... }}

Only ENTRY-CRITICAL fields may be patched (the ones that change and that hurt a traveller when
stale): passport rule, onward-ticket/blank-page flags, entry notes and their source, the health
block (required vaccinations, malaria, notes, source) and the emergency block. Everything else
(climate table, phrasebook, money, plugs, transit passes) is untouched.

`apply` merges the fields into the existing record, runs the FULL country-guide validator on the
merged result (banned sources, tri-state flags, etc.), and only then writes. `sources`, if given,
REPLACES the list, so it must include the old URLs that are still cited. A field whose value is
null stays null; an agent that could not verify a field simply leaves it out of the patch.
Then load with `npx tsx prisma/seed-countries.ts <country>` (one transaction per country).
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from validate_country_facts import SEED_PATH, validate  # noqa: E402

PATCHABLE = {
    "passport_validity_rule", "passport_validity_months_beyond_entry", "passport_validity_basis",
    "blank_pages_required", "onward_ticket_required", "entry_requirement_notes", "passport_source_url",
    "health", "emergency", "sources",
}


def load():
    return json.loads(SEED_PATH.read_text())


def brief(country):
    rec = next((c for c in load() if c["country"] == country), None)
    if not rec:
        print(f"No country guide for {country!r}.")
        return 1
    keep = {k: rec.get(k) for k in ["country", "last_verified_date"] + sorted(PATCHABLE)}
    print(json.dumps(keep, indent=1, ensure_ascii=False))
    return 0


def merge(rec, fields):
    out = dict(rec)
    for k, v in fields.items():
        if k in ("health", "emergency") and isinstance(v, dict) and isinstance(out.get(k), dict):
            m = dict(out[k])
            m.update(v)
            out[k] = m
        else:
            out[k] = v
    return out


def apply(paths, dry_run):
    data = load()
    index = {c["country"]: i for i, c in enumerate(data)}
    ok = bad = 0
    for path in paths:
        try:
            patch = json.loads(Path(path).read_text())
        except Exception as e:
            print(f"FAIL  {path}: {e}")
            bad += 1
            continue
        country = patch.get("country")
        fields = patch.get("fields") or {}
        label = f"{country} ({Path(path).name})"
        if country not in index:
            print(f"FAIL  {label}: no such country guide")
            bad += 1
            continue
        extra = set(fields) - PATCHABLE
        if extra:
            print(f"FAIL  {label}: not patchable here: {sorted(extra)}")
            bad += 1
            continue
        merged = merge(data[index[country]], fields)
        if patch.get("last_verified_date"):
            merged["last_verified_date"] = patch["last_verified_date"]
        errors, warnings = validate(merged, label)
        for w in warnings:
            print(f"  warn  {label}: {w}")
        if errors:
            print(f"FAIL  {label}")
            for e in errors:
                print(f"        {e}")
            bad += 1
            continue
        changed = [k for k in fields if data[index[country]].get(k) != merged.get(k)]
        data[index[country]] = merged
        ok += 1
        print(f"ok    {label}: changed {', '.join(changed) or 'nothing (date only)'}")
    if not dry_run and ok:
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
        rest = a[1:]
        files = [x for x in rest if not x.startswith("--")]
        return apply(files, "--dry-run" in rest) if files else (print(__doc__) or 1)
    print(__doc__)
    return 1


if __name__ == "__main__":
    sys.exit(main())
