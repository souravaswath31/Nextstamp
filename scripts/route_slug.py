"""Python twin of src/lib/slug.ts, so international road-eats regions can be keyed
by an itinerary's slug (`route:<slug>`) without a database round trip.

Parity is not assumed: `python3 scripts/route_slug.py --check` compares this against
the TypeScript implementation for every itinerary title (it shells out to tsx).
"""
import json
import re
import subprocess
import sys
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def slugify(title):
    s = unicodedata.normalize("NFKD", title)
    s = re.sub(r"[̀-ͯ]", "", s).lower()
    s = s.replace("&", " and ")
    s = re.sub(r"['’]", "", s)
    s = re.sub(r"[^a-z0-9]+", "-", s)
    s = re.sub(r"^-+|-+$", "", s)[:80]
    return re.sub(r"-+$", "", s)


def assign_unique(titles):
    taken, out = set(), []
    for t in titles:
        base = slugify(t) or "itinerary"
        slug, n = base, 2
        while slug in taken:
            slug, n = f"{base}-{n}", n + 1
        taken.add(slug)
        out.append(slug)
    return out


def itinerary_slugs():
    its = json.loads((ROOT / "data" / "itineraries-seed.json").read_text())
    return dict(zip([i["title"] for i in its], assign_unique([i["title"] for i in its])))


if __name__ == "__main__":
    if "--check" in sys.argv:
        its = json.loads((ROOT / "data" / "itineraries-seed.json").read_text())
        titles = [i["title"] for i in its]
        js = (
            'import {assignUniqueSlugs} from "./src/lib/slug";'
            f"console.log(JSON.stringify(assignUniqueSlugs({json.dumps(titles)})));"
        )
        tmp = ROOT / "slug-parity-tmp.ts"
        tmp.write_text(js)
        try:
            ts = json.loads(subprocess.run(["npx", "tsx", str(tmp)], cwd=ROOT, capture_output=True, text=True, check=True).stdout)
        finally:
            tmp.unlink()
        py = assign_unique(titles)
        bad = [(t, a, b) for t, a, b in zip(titles, py, ts) if a != b]
        print(f"{len(titles)} titles, {len(bad)} mismatches")
        for row in bad:
            print("  ", row)
        sys.exit(1 if bad else 0)
    for t, s in itinerary_slugs().items():
        print(s, "|", t)
