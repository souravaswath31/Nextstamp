#!/usr/bin/env python3
"""Re-verify existing visa rules in place.

    python3 scripts/reverify_visa.py brief "<destination>"          # what a research agent re-checks
    python3 scripts/reverify_visa.py list-stale [--days 120]        # destinations ordered by oldest rule
    python3 scripts/reverify_visa.py apply [--dry-run] <file.json> [more.json ...]

`apply` takes a JSON array of full rule objects (the same shape as data/visa-rules-seed.json)
for ONE OR MORE (passport, destination) pairs and replaces the matching existing rule IN PLACE:

  * the match key is (passport_country, destination_country, requires_held_document_country);
  * every candidate passes the same checks as new rules (validate_visa_rules.validate_one, with
    the rule's own key excluded from the duplicate test) plus the banned-source list used for
    country guides (Wikipedia and aggregators are rejected here too);
  * a rule whose key is not already on file is REJECTED unless --allow-new is given (a genuinely
    new cascade row, e.g. "visa-free if you hold a valid US visa", is the usual reason);
  * nothing is ever deleted. A rule an agent could not re-verify is simply left out of the file
    and keeps its old date, which is the honest state;
  * a change summary is printed: which fields changed, so a human can skim it.

Then load it into the database with `npx tsx prisma/update-visa-rules.ts` (updates changed rows
by key, inserts new ones, deletes nothing).
"""
import json
import re
import sys
from datetime import date, datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from validate_visa_rules import SEED_PATH, validate_one  # noqa: E402
from validate_country_facts import BANNED_SOURCE_PATTERNS  # noqa: E402

KEY = lambda r: (r["passport_country"], r["destination_country"], r.get("requires_held_document_country"))
FIELDS = ["visa_type", "max_stay_days", "conditions_text", "fee_notes", "source_url", "last_verified_date"]


def load():
    return json.loads(SEED_PATH.read_text())


def brief(dest):
    rules = [r for r in load() if r["destination_country"] == dest]
    if not rules:
        print(f"No rules for destination {dest!r}.")
        return 1
    print(json.dumps(rules, indent=1, ensure_ascii=False))
    return 0


def list_stale(days):
    today = date.today()
    by_dest = {}
    for r in load():
        d = datetime.strptime(r["last_verified_date"], "%Y-%m-%d").date()
        cur = by_dest.setdefault(r["destination_country"], [d, 0])
        cur[0] = min(cur[0], d)
        cur[1] += 1
    for dest, (oldest, n) in sorted(by_dest.items(), key=lambda kv: kv[1][0]):
        age = (today - oldest).days
        print(f"{'STALE ' if age > days else '      '}{dest:16} {n:2} rules, oldest {oldest} ({age} days)")
    return 0


def banned(url):
    return any(re.search(p, url, re.I) for p in BANNED_SOURCE_PATTERNS)


def apply(paths, dry_run, allow_new):
    rules = load()
    index = {KEY(r): i for i, r in enumerate(rules)}
    changed = rejected = unchanged = added = 0
    for path in paths:
        try:
            cands = json.loads(Path(path).read_text())
        except Exception as e:
            print(f"FAIL  {path}: {e}")
            rejected += 1
            continue
        if not isinstance(cands, list):
            print(f"FAIL  {path}: expected a JSON array")
            rejected += 1
            continue
        for c in cands:
            label = f"{c.get('passport_country')} -> {c.get('destination_country')}"
            if c.get("requires_held_document_country"):
                label += f" (via {c['requires_held_document_country']})"
            try:
                key = KEY(c)
            except KeyError:
                print(f"REJECTED  {label}: missing passport/destination")
                rejected += 1
                continue
            others = set(index) - {key}
            reasons = validate_one(c, others)
            if not reasons and banned(c["source_url"]):
                reasons.append(f"source_url {c['source_url']} is on the banned-source list")
            if key not in index and not allow_new:
                reasons.append("no existing rule with this key (use --allow-new for a genuinely new row)")
            if reasons:
                rejected += 1
                print(f"REJECTED  {label}")
                for r in reasons:
                    print(f"    - {r}")
                continue
            if key in index:
                old = rules[index[key]]
                diffs = [f for f in FIELDS if old.get(f) != c.get(f)]
                substantive = [f for f in diffs if f != "last_verified_date"]
                if not diffs:
                    unchanged += 1
                    continue
                new = dict(old)
                new.update({f: c.get(f) for f in FIELDS})
                rules[index[key]] = new
                if substantive:
                    changed += 1
                    print(f"CHANGED   {label}: {', '.join(substantive)}")
                else:
                    unchanged += 1  # only the date moved: re-confirmed, nothing else differs
            else:
                rules.append({k: c.get(k) for k in [
                    "passport_country", "destination_country", "visa_type", "requires_held_document_country",
                    "conditions_text", "max_stay_days", "fee_notes", "source_url", "last_verified_date"]})
                index[key] = len(rules) - 1
                added += 1
                print(f"ADDED     {label}")
    print(f"\n{changed} changed, {unchanged} re-confirmed (date only or identical), {added} added, {rejected} rejected.")
    if dry_run:
        print("Dry run: nothing written.")
    elif changed or unchanged or added:
        SEED_PATH.write_text(json.dumps(rules, indent=2, ensure_ascii=False) + "\n")
        print(f"Wrote {SEED_PATH.name}.")
    return 1 if rejected else 0


def main():
    a = sys.argv[1:]
    if not a:
        print(__doc__)
        return 1
    if a[0] == "brief" and len(a) == 2:
        return brief(a[1])
    if a[0] == "list-stale":
        days = int(a[a.index("--days") + 1]) if "--days" in a else 120
        return list_stale(days)
    if a[0] == "apply":
        rest = a[1:]
        dry = "--dry-run" in rest
        allow_new = "--allow-new" in rest
        files = [x for x in rest if not x.startswith("--")]
        return apply(files, dry, allow_new) if files else (print(__doc__) or 1)
    print(__doc__)
    return 1


if __name__ == "__main__":
    sys.exit(main())
