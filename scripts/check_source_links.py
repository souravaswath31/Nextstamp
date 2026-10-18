#!/usr/bin/env python3
"""Check that the official source links cited by visa rules and country guides still resolve.

    python3 scripts/check_source_links.py [out.json]

Collects every source URL from data/visa-rules-seed.json and data/country-facts-seed.json, requests
each once (GET, 20s timeout, 12 at a time) and reports:
  dead      404 / 410 / DNS failure / connection refused (the page is probably gone: fix these)
  blocked   401 / 403 / 429 / 5xx / timeout / TLS errors (bot protection or a flaky host: not proof of death)
  ok        2xx / 3xx
Needs network access; run it on your own machine.
"""
import json
import re
import sys
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
UA = {"User-Agent": "Mozilla/5.0 (compatible; NextStampLinkCheck/1.0)"}


def collect():
    urls = {}
    for r in json.loads((ROOT / "data/visa-rules-seed.json").read_text()):
        if r.get("source_url"):
            urls.setdefault(r["source_url"], []).append(f"visa {r['passport_country']}->{r['destination_country']}")
    for c in json.loads((ROOT / "data/country-facts-seed.json").read_text()):
        found = set()
        for k in ("sources", "passport_source_url"):
            v = c.get(k)
            if isinstance(v, str):
                found.add(v)
            elif isinstance(v, list):
                found.update(x for x in v if isinstance(x, str))
        for k in ("health", "emergency"):
            v = c.get(k) or {}
            if isinstance(v, dict) and v.get("source_url"):
                found.add(v["source_url"])
        for u in found:
            for part in re.split(r"[|\s]+", u):
                if part.startswith("http"):
                    urls.setdefault(part, []).append(f"guide {c['country']}")
    return urls


def check(url):
    req = urllib.request.Request(url, headers=UA)
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return url, "ok", r.status
    except urllib.error.HTTPError as e:
        if e.code in (404, 410):
            return url, "dead", e.code
        return url, "blocked", e.code
    except urllib.error.URLError as e:
        reason = str(e.reason)
        if re.search(r"Name or service not known|nodename nor servname|getaddrinfo|Connection refused", reason):
            return url, "dead", reason[:60]
        return url, "blocked", reason[:60]
    except Exception as e:  # noqa: BLE001
        return url, "blocked", type(e).__name__


def main():
    out = sys.argv[1] if len(sys.argv) > 1 else "source_links.json"
    urls = collect()
    print(f"{len(urls)} distinct source URLs")
    with ThreadPoolExecutor(12) as ex:
        results = list(ex.map(check, urls))
    json.dump([{"url": u, "status": s, "detail": d, "used_by": urls[u][:4]} for u, s, d in results], open(out, "w"), indent=1)
    for kind in ("dead", "blocked", "ok"):
        n = sum(1 for _, s, _ in results if s == kind)
        print(f"{kind}: {n}")
    print("\nDEAD LINKS")
    for u, s, d in results:
        if s == "dead":
            print(f"  {d}  {u}   <- {', '.join(urls[u][:3])}")


if __name__ == "__main__":
    main()
