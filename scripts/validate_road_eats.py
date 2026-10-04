#!/usr/bin/env python3
"""Content-pipeline gate for road-eats research.

    python3 scripts/validate_road_eats.py <candidate.json> [more.json ...]
    python3 scripts/validate_road_eats.py --check-existing
    python3 scripts/validate_road_eats.py --liveness            # network: probe every source URL

Passing candidates are appended to data/road-eats-seed.json, and each day in their
`day_map` gets an `eat_town` written into data/itineraries-seed.json (which is what
links an itinerary day to a stop's eats at seed time).

WHAT THIS CAN AND CANNOT DO — read before trusting a green run.

It checks structure and the *shape of the evidence*: every eat has a dated
open_evidence sentence, comes from a non-banned source, is not an obvious chain, and
every itinerary day in the region is mapped. It CANNOT check that a restaurant exists,
is open, or serves what the page says. A research agent that invents a plausible diner
passes every check here.

Restaurants are the most perishable data in the project, so there is a second line of
defence the other pipelines don't need: `--liveness` fetches every source URL and
reports which are dead. A 404/410 or DNS failure on an eat's own source page is a strong
signal the place is gone. (A 403/429 is bot-blocking, not death, and is reported
separately.) Run it after every merge and again periodically — an eat's verified date
is a claim about one afternoon, not a guarantee.
"""

import json
import re
import subprocess
import sys
from pathlib import Path
from urllib.parse import urlparse

REPO_ROOT = Path(__file__).resolve().parent.parent
SEED_PATH = REPO_ROOT / "data" / "road-eats-seed.json"
ITINERARIES_PATH = REPO_ROOT / "data" / "itineraries-seed.json"

KINDS = {"diner", "bbq", "bakery", "cafe", "brewery", "market", "regional", "dessert", "drive_in", "seafood"}
MEALS = {"breakfast", "lunch", "dinner", "snack", "any"}
PRICE_TIERS = {"$", "$$", "$$$", None}

# Sources that prove nothing about whether a place is currently operating, or are
# aggregators/listicles. Social pages are here because a page existing says nothing
# about whether the venue is open — plenty were abandoned years ago.
# Matched against the URL's HOSTNAME at label boundaries, never as a bare substring
# of the whole URL. The first version used substrings and `x\.com` (meant for
# X/Twitter) matched inside visitfredericksburgtx.com — rejecting a visitors'
# bureau, which is exactly the kind of source the contract wants. Each entry is
# "this host, or any subdomain of it".
BANNED_HOSTS = [
    r"wikipedia\.org", r"wikivoyage\.org",
    r"yelp\.[a-z.]+", r"tripadvisor\.[a-z.]+", r"foursquare\.com", r"opentable\.[a-z.]+",
    r"reddit\.com", r"facebook\.com", r"fb\.com", r"fb\.me", r"instagram\.com", r"tiktok\.com",
    r"x\.com", r"twitter\.com",
    r"lonelyplanet\.com", r"cheapism\.com", r"lovefood\.com", r"foodnetwork\.com",
    r"roadtrippers\.com", r"thrillist\.com", r"lemon8[a-z-]*\.com", r"pinterest\.[a-z.]+",
    r"doordash\.com", r"ubereats\.com", r"grubhub\.com", r"seamless\.com",
    r"maps\.google\.[a-z.]+", r"g\.page",
]
# Hosts that are only banned for part of their paths: google.com itself is fine for
# nothing here, but goo.gl/maps and google.com/maps are map listings.
BANNED_HOST_PATHS = [
    (r"google\.[a-z.]+", r"^/maps"),
    (r"goo\.gl", r"^/maps"),
]

# The contract says locally owned. These are the obvious ones an agent might drift to
# on a road trip — Waffle House and Cracker Barrel are genuinely iconic and genuinely
# chains; they're excluded on purpose, not by oversight.
CHAIN_NAMES = [
    "mcdonald", "starbucks", "subway", "burger king", "wendy's", "taco bell", "kfc",
    "dunkin", "panera", "chipotle", "olive garden", "applebee", "denny's", "cracker barrel",
    "waffle house", "ihop", "buffalo wild wings", "chick-fil-a", "domino's", "pizza hut",
    "papa john", "sonic drive", "dairy queen", "arby's", "popeyes", "five guys", "shake shack",
    "in-n-out", "whataburger", "culver's", "texas roadhouse", "outback", "red lobster",
    "bob evans", "perkins", "friendly's", "carl's jr", "jack in the box", "hardee",
]

VAGUE_EVIDENCE = re.compile(
    r"^\s*(popular|well[- ]?reviewed|highly[- ]?rated|local favou?rite|beloved|"
    r"a (local|town) (favou?rite|staple)|well[- ]known)\b",
    re.IGNORECASE,
)
# Evidence has to be dated, or it's a claim about no particular moment.
HAS_RECENT_YEAR = re.compile(r"\b20(2[4-9]|3\d)\b")
MIN_EVIDENCE_CHARS = 25


ADVICE_WORDS = re.compile(r"\b(pack|carry|bring|stock up|plan)\b", re.IGNORECASE)
LABELLED_ADVICE = re.compile(r"\bour (advice|read)\b", re.IGNORECASE)
REVIEW_SITE_TEXT = re.compile(r"\b(yelp|tripadvisor|google reviews?|zagat)\b", re.IGNORECASE)


def load(path):
    return json.loads(Path(path).read_text())


def is_http(u):
    return isinstance(u, str) and re.match(r"^https?://", u.strip()) is not None


def banned(u):
    """Return the matched rule if this URL's host is banned, else None."""
    try:
        parsed = urlparse(u.strip())
    except Exception:
        return None
    host = (parsed.hostname or "").lower()
    path = parsed.path or ""
    for pat in BANNED_HOSTS:
        if re.search(rf"(^|\.){pat}$", host):
            return pat
    for host_pat, path_pat in BANNED_HOST_PATHS:
        if re.search(rf"(^|\.){host_pat}$", host) and re.search(path_pat, path):
            return f"{host_pat}{path_pat}"
    return None


def itinerary_index():
    """title -> itinerary dict."""
    return {it["title"]: it for it in load(ITINERARIES_PATH)}


def region_itineraries(region_key, idx):
    out = []
    for it in idx.values():
        rs = it.get("related_states") or []
        countries = [c.lower().replace(" ", "-") for c in it.get("countries", [])]
        if region_key in rs or (not rs and region_key in countries):
            out.append(it)
    return out


def validate(obj, label, idx):
    errors, warnings = [], []

    if not isinstance(obj, dict):
        return [f"{label}: expected a JSON object"], []

    rk = obj.get("region_key")
    if not (isinstance(rk, str) and rk.strip()):
        errors.append("region_key is required")
        return errors, warnings

    d = obj.get("last_verified_date")
    if not (isinstance(d, str) and re.fullmatch(r"\d{4}-\d{2}-\d{2}", d or "")):
        errors.append(f"last_verified_date must be yyyy-mm-dd, got {d!r}")

    stops = obj.get("stops")
    if not isinstance(stops, list) or not stops:
        errors.append("stops must be a non-empty list")
        return errors, warnings

    towns = []
    seen_names_global = {}
    for si, stop in enumerate(stops):
        if not isinstance(stop, dict):
            errors.append(f"stops[{si}] is not an object")
            continue
        town = stop.get("town")
        if not (isinstance(town, str) and town.strip()):
            errors.append(f"stops[{si}].town is required")
            continue
        if town in towns:
            errors.append(f"town {town!r} appears twice")
        towns.append(town)

        note, note_url = stop.get("note"), stop.get("note_source_url")
        if note and not note_url:
            errors.append(f"{town}: note has no note_source_url — logistics claims need a source")
        if note_url:
            if not is_http(note_url):
                errors.append(f"{town}: note_source_url is not an http(s) URL")
            elif banned(note_url):
                errors.append(f"{town}: note_source_url cites a banned source: {note_url}")

        # Advice (pack lunch, carry snacks) belongs in the note but must not pass as
        # the source's claim — the UI puts a "Source" link right beside it.
        if note and ADVICE_WORDS.search(note) and not LABELLED_ADVICE.search(note):
            warnings.append(
                f"{town}: note contains advice (pack/carry/bring) not labelled 'Our advice:' or "
                "'Our read:' — it will read as the source's claim"
            )

        eats = stop.get("eats")
        if not isinstance(eats, list) or not eats:
            errors.append(f"{town}: needs at least one eat")
            continue
        if len(eats) > 4:
            errors.append(f"{town}: {len(eats)} eats — keep it to 4 at most; this is a short list, not a directory")
        if len(eats) == 1:
            warnings.append(f"{town}: only one verified eat")

        meals = set()
        names_here = set()
        for ei, e in enumerate(eats):
            tag = f"{town} / eat[{ei}]"
            if not isinstance(e, dict):
                errors.append(f"{tag} is not an object")
                continue

            name = str(e.get("name") or "").strip()
            if not name:
                errors.append(f"{tag}: name is required")
            else:
                tag = f"{town} / {name}"
                low = name.lower()
                for chain in CHAIN_NAMES:
                    if chain in low:
                        errors.append(f"{tag}: looks like a national chain ({chain!r}) — locally owned only")
                        break
                if low in names_here:
                    errors.append(f"{tag}: listed twice in {town}")
                names_here.add(low)
                seen_names_global.setdefault(low, []).append(town)

            if e.get("kind") not in KINDS:
                errors.append(f"{tag}: kind must be one of {sorted(KINDS)}, got {e.get('kind')!r}")
            if e.get("meal") not in MEALS:
                errors.append(f"{tag}: meal must be one of {sorted(MEALS)}, got {e.get('meal')!r}")
            else:
                meals.add(e["meal"])

            for f in ("what_to_order", "why", "source_name"):
                if not str(e.get(f) or "").strip():
                    errors.append(f"{tag}: {f} is required")

            if e.get("price_tier") not in PRICE_TIERS:
                errors.append(f"{tag}: price_tier must be $, $$, $$$ or null, got {e.get('price_tier')!r}")

            ho = e.get("hours_note")
            if ho is not None and not isinstance(ho, str):
                errors.append(f"{tag}: hours_note must be a string or null")

            ev = str(e.get("open_evidence") or "").strip()
            if len(ev) < MIN_EVIDENCE_CHARS:
                errors.append(f"{tag}: open_evidence is missing or too thin — say what you saw and where")
            elif VAGUE_EVIDENCE.match(ev):
                errors.append(f"{tag}: open_evidence is a reputation claim, not evidence it is operating: {ev[:60]!r}")
            elif not HAS_RECENT_YEAR.search(ev):
                errors.append(f"{tag}: open_evidence has no 2024+ date — evidence has to be dated: {ev[:70]!r}")

            if REVIEW_SITE_TEXT.search(ev):
                warnings.append(f"{tag}: open_evidence mentions a review site — evidence should be what you saw, not a reputation")
            url = e.get("source_url")
            if not is_http(url):
                errors.append(f"{tag}: source_url is not an http(s) URL: {url!r}")
            else:
                b = banned(url)
                if b:
                    errors.append(f"{tag}: cites a banned source ({b}): {url}")

        if len(eats) >= 3 and len(meals) == 1 and "any" not in meals:
            warnings.append(f"{town}: all {len(eats)} eats are {next(iter(meals))} — vary the meals")

    # --- day_map: complete, exact, and pointing at a real stop.
    day_map = obj.get("day_map")
    if not isinstance(day_map, list) or not day_map:
        errors.append("day_map must be a non-empty list")
        return errors, warnings

    expected = {}
    for it in region_itineraries(rk, idx):
        for day in it["days"]:
            expected[(it["title"], day["day_number"])] = False

    if not expected:
        errors.append(f"no itineraries found for region_key {rk!r}")

    for mi, m in enumerate(day_map):
        if not isinstance(m, dict):
            errors.append(f"day_map[{mi}] is not an object")
            continue
        key = (m.get("itinerary_title"), m.get("day_number"))
        if key not in expected:
            errors.append(f"day_map[{mi}]: {key[0]!r} day {key[1]!r} is not a day of any itinerary in {rk!r}")
            continue
        if expected[key]:
            errors.append(f"day_map: {key[0]!r} day {key[1]} is mapped twice")
        expected[key] = True
        t = m.get("town")
        if t is not None and t not in towns:
            errors.append(f"day_map: {key[0]!r} day {key[1]} maps to {t!r}, which is not one of your stops")

    for (title, dn), done in expected.items():
        if not done:
            errors.append(f"day_map is missing {title!r} day {dn} — every day needs an entry (town may be null)")

    # A stop nothing maps to is wasted research and probably a typo'd town name.
    used = {m.get("town") for m in day_map if isinstance(m, dict)}
    for t in towns:
        if t not in used:
            warnings.append(f"stop {t!r} is not used by any day in day_map")

    return errors, warnings


def write_json(path, data):
    Path(path).write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n")


def merge(obj):
    seed = load(SEED_PATH) if SEED_PATH.exists() else []
    seed.append(obj)
    seed.sort(key=lambda r: r["region_key"])
    write_json(SEED_PATH, seed)

    its = load(ITINERARIES_PATH)
    lookup = {(m["itinerary_title"], m["day_number"]): m["town"] for m in obj["day_map"]}
    changed = 0
    for it in its:
        for day in it["days"]:
            k = (it["title"], day["day_number"])
            if k in lookup:
                # A route that crosses states is in several regions' briefs, and
                # each region maps the other states' days to null. A null must
                # never erase a town another region already assigned.
                if lookup[k] is None and day.get("eat_town"):
                    continue
                day["eat_town"] = lookup[k]
                changed += 1
    write_json(ITINERARIES_PATH, its)
    return changed


def probe(url):
    """Returns ('ok'|'dead'|'blocked'|'unknown', http_code)."""
    try:
        r = subprocess.run(
            ["curl", "-s", "-4", "-L", "-o", "/dev/null", "--max-time", "20", "--max-redirs", "5",
             "-A", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36",
             "-w", "%{http_code}", url],
            capture_output=True, text=True, timeout=30,
        )
    except Exception:
        return "unknown", 0
    code_s = (r.stdout or "").strip()
    if r.returncode in (6, 7) or not code_s.isdigit():
        # 6 = could not resolve host, 7 = could not connect. A venue whose domain no
        # longer resolves is very likely gone.
        return ("dead", 0) if r.returncode in (6, 7) else ("unknown", 0)
    code = int(code_s)
    if 200 <= code < 400:
        return "ok", code
    if code in (404, 410):
        return "dead", code
    if code in (401, 403, 429, 999):
        return "blocked", code
    if code >= 500:
        return "unknown", code
    return "unknown", code


def liveness():
    seed = load(SEED_PATH) if SEED_PATH.exists() else []
    urls = []
    for region in seed:
        for stop in region["stops"]:
            if stop.get("note_source_url"):
                urls.append((region["region_key"], stop["town"], "(stop note)", stop["note_source_url"]))
            for e in stop["eats"]:
                urls.append((region["region_key"], stop["town"], e["name"], e["source_url"]))
    seen, results = {}, {"ok": 0, "dead": 0, "blocked": 0, "unknown": 0}
    dead, blocked = [], []
    for rk, town, name, url in urls:
        if url not in seen:
            seen[url] = probe(url)
        status, code = seen[url]
        results[status] += 1
        if status == "dead":
            dead.append((rk, town, name, url, code))
        elif status == "blocked":
            blocked.append((rk, town, name, url, code))
    print(f"{len(urls)} source links checked ({len(seen)} unique): "
          f"{results['ok']} ok, {results['dead']} dead, {results['blocked']} bot-blocked, {results['unknown']} unknown")
    if dead:
        print("\nDEAD — likely closed or moved; investigate before shipping:")
        for rk, town, name, url, code in dead:
            print(f"  [{rk}] {town} / {name}  ({code or 'no DNS'})  {url}")
    if blocked:
        print(f"\nBot-blocked ({len(blocked)}) — not evidence either way:")
        for rk, town, name, url, code in blocked[:12]:
            print(f"  [{rk}] {town} / {name}  ({code})")
    return 1 if dead else 0


def main():
    args = sys.argv[1:]
    if not args:
        print(__doc__)
        return 1
    if args[0] == "--liveness":
        return liveness()

    idx = itinerary_index()

    if args[0] == "--check-existing":
        seed = load(SEED_PATH) if SEED_PATH.exists() else []
        failed = 0
        for obj in seed:
            errors, warnings = validate(obj, obj.get("region_key", "?"), idx)
            for w in warnings:
                print(f"  warn  {obj['region_key']}: {w}")
            if errors:
                failed += 1
                print(f"FAIL  {obj['region_key']}")
                for e in errors:
                    print(f"        {e}")
        print(f"\n{len(seed) - failed}/{len(seed)} existing regions pass.")
        return 1 if failed else 0

    existing = {r["region_key"] for r in (load(SEED_PATH) if SEED_PATH.exists() else [])}
    rejected = 0
    for path in args:
        label = Path(path).name
        try:
            obj = load(path)
        except Exception as ex:
            print(f"FAIL  {label}: unreadable — {ex}")
            rejected += 1
            continue
        if isinstance(obj, list) and len(obj) == 1:
            obj = obj[0]

        errors, warnings = validate(obj, label, idx)
        rk = obj.get("region_key") if isinstance(obj, dict) else None
        if rk in existing:
            errors.append(f"{rk!r} is already in the seed file — patch it in place instead")

        for w in warnings:
            print(f"  warn  {label}: {w}")
        if errors:
            rejected += 1
            print(f"FAIL  {label} ({rk})")
            for e in errors:
                print(f"        {e}")
            continue

        changed = merge(obj)
        existing.add(rk)
        n_eats = sum(len(s["eats"]) for s in obj["stops"])
        print(f"ok    {label} ({rk}): {len(obj['stops'])} stops, {n_eats} eats, {changed} itinerary days mapped")

    return 1 if rejected else 0


if __name__ == "__main__":
    sys.exit(main())
