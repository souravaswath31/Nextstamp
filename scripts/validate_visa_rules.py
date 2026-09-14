#!/usr/bin/env python3
"""
Visa-rule content pipeline — automated gate for new visa rules before they
merge into data/visa-rules-seed.json. Mirrors validate_itineraries.py: no
human read-through required, so every check that can be mechanical, is.

Checks:
  - required fields present
  - visa_type is one of the canonical values (src/lib/types.ts VISA_STATUS_CLASSES)
  - source_url is present and looks like a real URL — this project's whole
    differentiator is that visa rules are sourced and dated, not guessed;
    a rule with no source is rejected outright, not merged with a warning
  - last_verified_date parses as a real date and isn't in the future
  - conditions_text is non-empty
  - no duplicate (passport_country, destination_country,
    requires_held_document_country) triple already on file — this triple is
    the Prisma @@unique constraint, so a collision would fail at seed time
    anyway; catching it here gives a clear reason instead of a Prisma error

This does not verify that the sourceUrl actually says what conditions_text
claims — that's a research-step responsibility, not something checkable
mechanically. Treat a passing rule as "structurally sound and sourced," not
as "fact-checked."

Usage:
    python3 scripts/validate_visa_rules.py <candidates.json>
"""
import json
import sys
from datetime import date, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SEED_PATH = ROOT / "data" / "visa-rules-seed.json"

ALLOWED_VISA_TYPES = {"visa-free", "visa-on-arrival", "e-visa", "advance-visa-required"}


def fail(reasons, msg):
    reasons.append(msg)


def validate_one(rule, existing_keys):
    reasons = []

    required = [
        "passport_country", "destination_country", "visa_type",
        "conditions_text", "source_url", "last_verified_date",
    ]
    for field in required:
        if not rule.get(field):
            fail(reasons, f"missing or empty required field '{field}'")
    if reasons:
        return reasons

    if rule["visa_type"] not in ALLOWED_VISA_TYPES:
        fail(reasons, f"invalid visa_type '{rule['visa_type']}' — must be one of {sorted(ALLOWED_VISA_TYPES)}")

    src = rule["source_url"]
    if not (src.startswith("http://") or src.startswith("https://")):
        fail(reasons, f"source_url '{src}' doesn't look like a URL — every rule must cite a real source")

    try:
        verified = datetime.strptime(rule["last_verified_date"], "%Y-%m-%d").date()
        if verified > date.today():
            fail(reasons, f"last_verified_date {verified} is in the future")
    except ValueError:
        fail(reasons, f"last_verified_date '{rule['last_verified_date']}' is not a valid YYYY-MM-DD date")

    key = (rule["passport_country"], rule["destination_country"], rule.get("requires_held_document_country"))
    if key in existing_keys:
        fail(reasons, f"duplicate rule for {key} — this exact (passport, destination, cascade-document) triple already exists (Prisma's unique constraint would reject it anyway)")

    max_stay = rule.get("max_stay_days")
    if max_stay is not None and (not isinstance(max_stay, int) or max_stay <= 0):
        fail(reasons, f"max_stay_days must be a positive integer or null, got {max_stay!r}")

    return reasons


def main():
    if len(sys.argv) != 2:
        print("usage: python3 scripts/validate_visa_rules.py <candidates.json>")
        sys.exit(1)

    candidates_path = Path(sys.argv[1])
    try:
        candidates = json.loads(candidates_path.read_text())
    except Exception as e:
        print(f"Could not parse {candidates_path}: {e}")
        sys.exit(1)

    if not isinstance(candidates, list):
        print("candidates file must contain a JSON array of visa rule objects")
        sys.exit(1)

    existing = json.loads(SEED_PATH.read_text())
    existing_keys = {
        (r["passport_country"], r["destination_country"], r.get("requires_held_document_country"))
        for r in existing
    }

    passed, rejected = [], []
    for i, rule in enumerate(candidates):
        reasons = validate_one(rule, existing_keys)
        label = f"{rule.get('passport_country', '?')} -> {rule.get('destination_country', f'<candidate #{i}>')}"
        if rule.get("requires_held_document_country"):
            label += f" (via {rule['requires_held_document_country']})"
        if reasons:
            rejected.append((label, reasons))
            print(f"REJECTED: {label}")
            for r in reasons:
                print(f"  - {r}")
        else:
            passed.append(rule)
            print(f"PASSED:   {label}")
            existing_keys.add((rule["passport_country"], rule["destination_country"], rule.get("requires_held_document_country")))

    print(f"\n{len(passed)} passed, {len(rejected)} rejected out of {len(candidates)} candidates.")

    if passed:
        merged = existing + passed
        SEED_PATH.write_text(json.dumps(merged, indent=2, ensure_ascii=False) + "\n")
        print(f"Merged {len(passed)} visa rules into {SEED_PATH.relative_to(ROOT)} ({len(existing)} -> {len(merged)}).")
        print("Run `npm run seed` to load them into the database.")

    sys.exit(0)


if __name__ == "__main__":
    main()
