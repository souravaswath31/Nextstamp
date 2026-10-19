#!/usr/bin/env python3
"""Geocode the itinerary days of specific countries, picking the candidate that fits the trip.

    python3 scripts/geocode_round.py --countries France,Italy,Spain [--dry-run]

Why this exists alongside geocode_itineraries.py: that script constrains every query
to one country code and takes the best-ranked hit, which is right for US states but
produced real errors for the round-5 countries ("Monaco" with countrycodes=fr returned
a hamlet in Corsica; "Calanques" a Corsican gorge; "Amboise" a village in the Somme).
Here each query asks Nominatim for several candidates with country codes attached,
keeps those inside the trip's countries (plus declared neighbours such as Monaco or
the Vatican), and chooses the one NEAREST THE TRIP'S RUNNING POSITION: the previous
accepted stop, or the country's reference city for the first. A candidate farther than
the per-country cap from that anchor is rejected, so a wrong namesake on the other
side of the country cannot win. Anything unresolved stays null; nothing is guessed.

Same rules as the other geocoders: authoring time only, 1 request per second, curl,
a real User-Agent. Results still need an eyeball: run with --dry-run and read them.
"""
import argparse
import json
import re
import subprocess
import sys
import time
import urllib.parse
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from geocode_itineraries import clean_title, looks_like_place, haversine_km  # noqa: E402
from geocode_places import NOMINATIM, USER_AGENT, RATE_LIMIT_SECONDS  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
ITINERARIES = ROOT / "data" / "itineraries-seed.json"
FACTS = ROOT / "data" / "country-facts-seed.json"

# Codes that may legitimately appear inside a trip to this country.
NEIGHBOURS = {
    "France": {"mc"},
    "Italy": {"va", "sm"},
    "Spain": {"ad"},
    "Portugal": set(),
    "Greece": set(),
    "UK": {"gb", "im", "je", "gg"},
    "Canada": set(),
    "Australia": set(),
    "South Korea": set(),
    "South Africa": {"ls", "sz"},
    "Hong Kong": {"cn", "mo"},
}
# Largest sensible hop between consecutive stops, km. Flight-connected trips need more.
CAP_KM = {"Canada": 4500, "Australia": 3500, "South Africa": 1500, "South Korea": 500,
          "UK": 800, "France": 800, "Italy": 1000, "Spain": 1100, "Portugal": 600, "Greece": 700,
          # Round 7: large or flight-connected countries (the 900 km default rejects Kerala from Delhi).
          "India": 3000, "China": 3000, "Malaysia": 2000, "Brazil": 3500, "Argentina": 3500, "Chile": 4500,
          "Ecuador": 1500, "Tanzania": 1500, "Kenya": 800, "Jordan": 400, "New Zealand": 1200, "Nepal": 400,
          "Cambodia": 500, "Taiwan": 400, "Singapore": 100, "Dominican Republic": 500,
          # Round 8
          "Norway": 2000, "Sweden": 1000, "Hong Kong": 100, "Laos": 800, "Uzbekistan": 1300, "Cuba": 1000,
          "Jamaica": 300, "Panama": 600, "Bolivia": 800, "Namibia": 1000, "Botswana": 900, "Rwanda": 300,
          "Ghana": 800, "Mauritius": 150, "Oman": 1000, "Qatar": 150, "Israel": 400, "Finland": 1200,
          "Slovenia": 300, "Romania": 700,
          # Round 9
          "Albania": 600, "Montenegro": 300, "Bulgaria": 600, "Estonia": 400, "Latvia": 400, "Lithuania": 400,
          "Slovakia": 500, "Cyprus": 250, "Malta": 80, "Mongolia": 1500, "Bhutan": 500, "Kazakhstan": 1500,
          "Saudi Arabia": 1500, "Azerbaijan": 500, "Tunisia": 900, "Senegal": 500, "Ethiopia": 1500,
          "Zambia": 1000, "Zimbabwe": 800, "Madagascar": 1200, "Uganda": 600, "Guatemala": 500,
          "Uruguay": 600, "Fiji": 400}

EXTRA_NOISE = re.compile(r"^(tgv|train|bus|ferry|fly|flight|drive|rail|coach|transfer)\s+(to|from)\s+", re.I)
# "Seoul to Busan" style: the stop is the destination of the leg.
LEG = re.compile(r"^.+?\s+to\s+(.+)$", re.I)


def query_for(title):
    t = EXTRA_NOISE.sub("", title.strip())
    if LEG.match(t) and not re.match(r"^(day|arrive)", t, re.I):
        t = LEG.match(t).group(1)
    return clean_title(t)


def candidates(q):
    params = {"q": q, "format": "json", "limit": "8", "addressdetails": "1", "accept-language": "en"}
    url = f"{NOMINATIM}?{urllib.parse.urlencode(params)}"
    try:
        out = subprocess.run(["curl", "-s", "-4", "--max-time", "20", "-A", USER_AGENT, url],
                             capture_output=True, text=True, timeout=30).stdout
        data = json.loads(out) if out.strip() else []
    except Exception:
        return []
    res = []
    for h in data:
        try:
            res.append({
                "lat": float(h["lat"]), "lon": float(h["lon"]),
                "cc": (h.get("address", {}).get("country_code") or "").lower(),
                "type": (h.get("type") or "").lower(), "cls": (h.get("class") or "").lower(),
                "name": h.get("display_name", ""),
            })
        except (KeyError, ValueError):
            pass
    return res


def pick(cands, allowed, anchor, cap):
    good = [c for c in cands if c["cc"] in allowed
            and c["type"] not in ("administrative", "county", "state", "region", "province")]
    if not good:
        good = [c for c in cands if c["cc"] in allowed]
    if not good:
        return None
    best = min(good, key=lambda c: haversine_km(anchor[0], anchor[1], c["lat"], c["lon"]))
    return best if haversine_km(anchor[0], anchor[1], best["lat"], best["lon"]) <= cap else None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--countries", required=True)
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument(
        "--overrides",
        help='JSON {"Itinerary title prefix|day": "query" | {"q": "...", "must": ["Region", ...], "cc": "mc"}}. '
        "`must` makes a result valid only if its display name contains one of the tokens; "
        "`cc` allows that country code for this day.",
    )
    args = ap.parse_args()
    wanted = {c.strip() for c in args.countries.split(",") if c.strip()}
    overrides = json.loads(Path(args.overrides).read_text()) if args.overrides else {}

    facts = {f["country"]: f for f in json.loads(FACTS.read_text())}
    iso = {k: v["iso2"].lower() for k, v in facts.items()}
    its = json.loads(ITINERARIES.read_text())

    for it in its:
        cs = [c for c in it["countries"] if c in wanted]
        if not cs:
            continue
        country = cs[0]
        allowed = {iso[country]} | NEIGHBOURS.get(country, set())
        ref = facts[country]
        anchor = (ref["latitude"], ref["longitude"])
        cap = CAP_KM.get(country, 900)
        print(f"\n{it['title']}")
        for d in it["days"]:
            ov = next((v for k, v in overrides.items()
                       if k.rsplit("|", 1)[1] == str(d["day_number"]) and it["title"].startswith(k.rsplit("|", 1)[0])), None)
            must, extra_cc = [], set()
            if isinstance(ov, dict):
                q, must = ov["q"], [m.lower() for m in ov.get("must", [])]
                extra_cc = {ov["cc"]} if ov.get("cc") else set()
            else:
                q = ov
            if q is None:
                if not looks_like_place(d["title"]):
                    d["latitude"] = d["longitude"] = None
                    print(f"  skip d{d['day_number']} (not a place): {d['title'][:50]}")
                    continue
                q = query_for(d["title"])
            # An explicit cc restricts the day to that country alone (Monaco is not France).
            day_allowed = extra_cc or allowed
            def region_ok(cs):
                return [c for c in cs if not must or any(m in c["name"].lower() for m in must)]
            time.sleep(RATE_LIMIT_SECONDS)
            hit = pick(region_ok(candidates(f"{q}, {country}" if country not in ("UK",) else q)), day_allowed, anchor, cap)
            if hit is None:
                time.sleep(RATE_LIMIT_SECONDS)
                hit = pick(region_ok(candidates(q)), day_allowed, anchor, cap)
            if hit is None:
                d["latitude"] = d["longitude"] = None
                print(f"  --   d{d['day_number']} {q[:40]}")
                continue
            d["latitude"], d["longitude"] = round(hit["lat"], 6), round(hit["lon"], 6)
            anchor = (hit["lat"], hit["lon"])
            print(f"  ok   d{d['day_number']} {q[:36]:38} ({hit['lat']:.3f}, {hit['lon']:.3f})  {hit['name'][:60]}")
        if not args.dry_run:
            ITINERARIES.write_text(json.dumps(its, indent=2, ensure_ascii=False) + "\n")


if __name__ == "__main__":
    main()
