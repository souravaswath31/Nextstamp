#!/usr/bin/env python3
"""Content-pipeline gate for the country-facts data set.

Usage:
    python3 scripts/validate_country_facts.py <candidate.json> [more.json ...]
    python3 scripts/validate_country_facts.py --check-existing

Each candidate file holds ONE country object (the shape documented in the
research contract handed to each agent). Passing objects are appended to
data/country-facts-seed.json; failing ones are reported and left out.

WHAT THIS CAN AND CANNOT DO — read this before trusting a green run.

It checks *structure and sourcing presence*: required fields exist, enums use
canonical values, the climate table has twelve named months in order, the
phrasebook is long enough, ISO codes and IANA timezones are well-formed, and
every source URL is an http(s) URL that is not on the banned-source list.

It CANNOT check whether a fact is true. A research agent that writes the wrong
emergency number, or a passport-validity rule that changed last month, will
pass every check here. Per CLAUDE.md, this project ships content with no human
review gate by explicit project-owner decision — the rigor lives in the
research prompt, not in this script. If you want fewer factual errors, tighten
the prompt; making this script stricter will not help.

One thing it does catch that matters: Wikipedia and aggregator sources. This
project had to re-research 49 visa rules because that slipped through once,
so it is enforced mechanically here rather than trusted to the prompt.
"""

import json
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
SEED_PATH = REPO_ROOT / "data" / "country-facts-seed.json"

MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
]

VALIDITY_BASES = {"entry", "exit", "duration-of-stay", "none"}
CLIMATE_RATINGS = {"peak", "shoulder", "low", "avoid"}

# Sources this project does not accept. Wikipedia is the one that already cost
# a 49-record re-research pass; the rest are aggregators that restate official
# rules without carrying responsibility for them.
BANNED_SOURCE_PATTERNS = [
    r"wikipedia\.org",
    r"wikivoyage\.org",
    r"ivisa\.com",
    r"visahq\.com",
    r"numbeo\.com",
    r"worldstandards\.eu",
    r"worldstandards\.com",
    r"timeanddate\.com",
    r"tripadvisor\.",
    r"reddit\.com",
    r"lonelyplanet\.com",
]

REQUIRED_TOP_LEVEL = [
    "country",
    "iso2",
    "currency_code",
    "currency_name",
    "primary_timezone",
    "timezone_label",
    "passport_validity_rule",
    "last_verified_date",
]

# Phrase coverage we insist on — the set a visitor actually reaches for. Matched
# case-insensitively on a substring, so "Thank you very much" satisfies
# "thank you".
REQUIRED_PHRASE_HINTS = ["hello", "thank", "please", "excuse", "how much", "toilet", "help"]

MIN_PHRASES = 10
MAX_PHRASES = 24


def is_http_url(value):
    return isinstance(value, str) and re.match(r"^https?://", value.strip()) is not None


def collect_source_urls(obj):
    """Every *_source_url and every entry in `sources`, wherever they sit."""
    urls = []
    for key in ("passport_source_url", "climate_source_url"):
        if obj.get(key):
            urls.append((key, obj[key]))
    for section in ("health", "money", "power", "emergency", "getting_around", "connectivity"):
        node = obj.get(section)
        if isinstance(node, dict) and node.get("source_url"):
            urls.append((f"{section}.source_url", node["source_url"]))
    for i, u in enumerate(obj.get("sources") or []):
        urls.append((f"sources[{i}]", u))
    return urls


def validate(obj, label):
    errors = []
    warnings = []

    if not isinstance(obj, dict):
        return [f"{label}: expected a JSON object, got {type(obj).__name__}"], []

    for field in REQUIRED_TOP_LEVEL:
        value = obj.get(field)
        if value is None or (isinstance(value, str) and not value.strip()):
            errors.append(f"missing or empty required field: {field}")

    iso2 = obj.get("iso2")
    if not (isinstance(iso2, str) and re.fullmatch(r"[A-Z]{2}", iso2 or "")):
        errors.append(f"iso2 must be two uppercase letters, got {iso2!r}")

    code = obj.get("currency_code")
    if not (isinstance(code, str) and re.fullmatch(r"[A-Z]{3}", code or "")):
        errors.append(f"currency_code must be a 3-letter ISO 4217 code, got {code!r}")

    tz = obj.get("primary_timezone")
    # "Area/Location", optionally a third segment (America/Argentina/Salta),
    # plus the handful of single-word zones (UTC).
    if not (isinstance(tz, str) and re.fullmatch(r"[A-Za-z_]+(/[A-Za-z_+\-0-9]+){0,2}", tz or "")):
        errors.append(f"primary_timezone must look like an IANA zone, got {tz!r}")

    basis = obj.get("passport_validity_basis", "none")
    if basis not in VALIDITY_BASES:
        errors.append(
            f"passport_validity_basis must be one of {sorted(VALIDITY_BASES)}, got {basis!r}"
        )

    months = obj.get("passport_validity_months_beyond_entry", 0)
    if not isinstance(months, int) or isinstance(months, bool) or months < 0 or months > 24:
        errors.append(
            f"passport_validity_months_beyond_entry must be an integer 0-24, got {months!r}"
        )
    elif basis in ("duration-of-stay", "none") and months != 0:
        errors.append(
            f"passport_validity_basis is {basis!r} so months_beyond_entry must be 0, got {months}"
        )
    elif basis in ("entry", "exit") and months == 0:
        warnings.append(
            f"passport_validity_basis is {basis!r} but months_beyond_entry is 0 — "
            "if there is genuinely no minimum, the basis should be 'none'"
        )

    pages = obj.get("blank_pages_required")
    if pages is not None and (not isinstance(pages, int) or isinstance(pages, bool) or pages < 0):
        errors.append(f"blank_pages_required must be a non-negative integer or null, got {pages!r}")

    # Tri-state: true (stated by the destination), false (confirmed not
    # required), null (nobody could confirm). null is a legitimate answer and
    # must not be coerced — see the field comment in schema.prisma.
    if obj.get("onward_ticket_required") is not None and not isinstance(
        obj.get("onward_ticket_required"), bool
    ):
        errors.append("onward_ticket_required must be true, false, or null")

    # --- Climate: exactly twelve months, in order, with sane temperatures.
    climate = obj.get("climate")
    if not isinstance(climate, list) or len(climate) != 12:
        errors.append(
            f"climate must be a list of exactly 12 entries, got "
            f"{len(climate) if isinstance(climate, list) else type(climate).__name__}"
        )
    else:
        for i, m in enumerate(climate):
            if not isinstance(m, dict):
                errors.append(f"climate[{i}] is not an object")
                continue
            if m.get("month") != MONTHS[i]:
                errors.append(
                    f"climate[{i}].month must be {MONTHS[i]!r} (12 entries, January first), "
                    f"got {m.get('month')!r}"
                )
            rating = m.get("rating", "shoulder")
            if rating not in CLIMATE_RATINGS:
                errors.append(
                    f"climate[{i}].rating must be one of {sorted(CLIMATE_RATINGS)}, got {rating!r}"
                )
            hi, lo = m.get("avg_high_c"), m.get("avg_low_c")
            for name, t in (("avg_high_c", hi), ("avg_low_c", lo)):
                if t is not None and (not isinstance(t, int) or isinstance(t, bool) or not -60 <= t <= 60):
                    errors.append(f"climate[{i}].{name} must be an integer -60..60 or null, got {t!r}")
            if isinstance(hi, int) and isinstance(lo, int) and not isinstance(hi, bool) and lo > hi:
                errors.append(f"climate[{i}]: avg_low_c ({lo}) is above avg_high_c ({hi})")

    # --- Phrasebook.
    phrases = obj.get("phrases")
    if not isinstance(phrases, list) or not (MIN_PHRASES <= len(phrases) <= MAX_PHRASES):
        errors.append(
            f"phrases must be a list of {MIN_PHRASES}-{MAX_PHRASES} entries, got "
            f"{len(phrases) if isinstance(phrases, list) else type(phrases).__name__}"
        )
    else:
        joined = " | ".join(str(p.get("phrase_en", "")) for p in phrases if isinstance(p, dict)).lower()
        for hint in REQUIRED_PHRASE_HINTS:
            if hint not in joined:
                errors.append(f"phrases is missing anything matching {hint!r}")
        for i, p in enumerate(phrases):
            if not isinstance(p, dict):
                errors.append(f"phrases[{i}] is not an object")
                continue
            if not str(p.get("phrase_en", "")).strip():
                errors.append(f"phrases[{i}].phrase_en is empty")
            if not str(p.get("local", "")).strip():
                errors.append(f"phrases[{i}].local is empty")
        if not str(obj.get("phrases_language") or "").strip():
            errors.append("phrases_language is required when phrases are present")

    # --- Emergency numbers: at least one reachable number, digits only.
    emergency = obj.get("emergency") or {}
    if not isinstance(emergency, dict):
        errors.append("emergency must be an object")
    else:
        numbers = {
            k: emergency.get(k)
            for k in ("police", "ambulance", "fire", "universal", "tourist_police")
        }
        if not any(v for v in numbers.values()):
            errors.append("emergency needs at least one of police/ambulance/fire/universal")
        for k, v in numbers.items():
            if v is None:
                continue
            if not isinstance(v, str) or not re.fullmatch(r"[0-9*#+][0-9*#+ /-]{0,19}", v.strip()):
                errors.append(
                    f"emergency.{k} must be a dialable number string, got {v!r} — "
                    "prose belongs in emergency.notes"
                )

    # --- Transit passes.
    passes = (obj.get("getting_around") or {}).get("passes")
    if passes is not None:
        if not isinstance(passes, list):
            errors.append("getting_around.passes must be a list (may be empty)")
        else:
            for i, p in enumerate(passes):
                if not isinstance(p, dict) or not str(p.get("name", "")).strip():
                    errors.append(f"getting_around.passes[{i}] needs a name")

    # --- Sourcing. The check that exists because of a real incident.
    urls = collect_source_urls(obj)
    if not urls:
        errors.append("no source URLs at all — every fact here has to be traceable")
    for where, url in urls:
        if not is_http_url(url):
            errors.append(f"{where} is not an http(s) URL: {url!r}")
            continue
        for pattern in BANNED_SOURCE_PATTERNS:
            if re.search(pattern, url, re.IGNORECASE):
                errors.append(
                    f"{where} cites a banned source ({pattern}): {url} — "
                    "official government/met-service/operator sources only"
                )
                break

    # Sections that ought to carry their own source, flagged rather than failed:
    # a genuinely unverifiable section should be null, not sourceless.
    for section in ("health", "money", "power", "emergency", "getting_around", "connectivity"):
        node = obj.get(section)
        if isinstance(node, dict) and any(
            v not in (None, "", [], {}) for k, v in node.items() if k != "source_url"
        ) and not node.get("source_url"):
            warnings.append(f"{section} has content but no source_url")

    date = obj.get("last_verified_date")
    if not (isinstance(date, str) and re.fullmatch(r"\d{4}-\d{2}-\d{2}", date or "")):
        errors.append(f"last_verified_date must be yyyy-mm-dd, got {date!r}")

    return errors, warnings


def main():
    args = sys.argv[1:]
    if not args:
        print(__doc__)
        return 1

    existing = json.loads(SEED_PATH.read_text()) if SEED_PATH.exists() else []
    existing_countries = {c.get("country") for c in existing}

    if args[0] == "--check-existing":
        # Run the full gate over everything already merged — the lesson from the
        # Wikipedia incident is that a stale count in a doc is not evidence.
        failed = 0
        for obj in existing:
            errors, warnings = validate(obj, obj.get("country", "?"))
            for w in warnings:
                print(f"  warn  {obj.get('country')}: {w}")
            if errors:
                failed += 1
                print(f"FAIL  {obj.get('country')}")
                for e in errors:
                    print(f"        {e}")
        print(f"\n{len(existing) - failed}/{len(existing)} existing records pass.")
        return 1 if failed else 0

    accepted, rejected = [], []
    seen_in_batch = set()

    for path_str in args:
        path = Path(path_str)
        label = path.name
        if not path.exists():
            print(f"FAIL  {label}: file not found")
            rejected.append(label)
            continue
        try:
            obj = json.loads(path.read_text())
        except json.JSONDecodeError as e:
            print(f"FAIL  {label}: invalid JSON — {e}")
            rejected.append(label)
            continue

        # Tolerate a single-element array, since "write one object" is
        # occasionally read as "write a list of one".
        if isinstance(obj, list) and len(obj) == 1:
            obj = obj[0]

        errors, warnings = validate(obj, label)
        country = obj.get("country") if isinstance(obj, dict) else None

        if country in existing_countries:
            errors.append(f"{country!r} is already in the seed file — patch it in place instead")
        if country in seen_in_batch:
            errors.append(f"{country!r} appears twice in this batch")

        for w in warnings:
            print(f"  warn  {label}: {w}")

        if errors:
            print(f"FAIL  {label} ({country})")
            for e in errors:
                print(f"        {e}")
            rejected.append(label)
        else:
            print(f"ok    {label} ({country})")
            accepted.append(obj)
            seen_in_batch.add(country)

    if accepted:
        merged = existing + accepted
        merged.sort(key=lambda c: c.get("country", ""))
        SEED_PATH.write_text(json.dumps(merged, indent=2, ensure_ascii=False) + "\n")
        print(f"\nAppended {len(accepted)} record(s). {SEED_PATH.name} now has {len(merged)}.")
    else:
        print("\nNothing appended.")

    if rejected:
        print(f"Rejected {len(rejected)}: {', '.join(rejected)}")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
