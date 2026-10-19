#!/usr/bin/env python3
"""Watch the official pages behind every visa rule and report the ones that changed.

    python3 scripts/monitor_sources.py                 # all sources
    python3 scripts/monitor_sources.py --tier A        # only the popular destinations (daily job)
    python3 scripts/monitor_sources.py --limit 20      # smoke test
    python3 scripts/monitor_sources.py --report out.md # where to write the human-readable report

It NEVER edits a rule. A changed page is a lead: a person opens the page, decides whether the rule is
wrong, and fixes it through scripts/reverify_visa.py. The point is that nothing goes stale silently.

State lives in monitor/state.json (url -> normalised-text hash, last checked, last changed, status) and
monitor/snapshots/<hash-of-url>.txt (the last normalised text, so the next run can diff against it).
The GitHub Action commits both to the `source-monitor` branch.

If ANTHROPIC_API_KEY is set, each diff is summarised by a small model into "material or not" with the
changed sentence quoted. That summary is a hint for the reader, never an instruction to change data.

Pages that block automated fetches (403, scripted shells) are recorded as `unreadable` and listed
once so you know they are NOT being watched. Honest coverage beats a long list of silent blanks.
"""
import argparse
import difflib
import hashlib
import json
import os
import re
import sys
import time
import urllib.request
import urllib.error
from datetime import datetime, timezone
from html import unescape
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SEED = ROOT / "data" / "visa-rules-seed.json"
STATE_DIR = ROOT / "monitor"
STATE = STATE_DIR / "state.json"
SNAP = STATE_DIR / "snapshots"
UA = "NextStampSourceMonitor/1.0 (checks official visa pages for changes; contact via the site)"
MAX_BYTES = 2_000_000
TIER_A = {
    "Thailand", "Japan", "UAE", "Turkey", "Mexico", "Vietnam", "Indonesia", "Singapore", "South Korea", "China",
    "France", "Italy", "Spain", "Germany", "Portugal", "Greece", "Egypt", "Morocco", "Malaysia", "Sri Lanka",
    "Philippines", "Costa Rica", "Saudi Arabia", "Qatar", "USA", "UK", "Canada", "Australia", "Maldives", "Cambodia",
}


def now():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def normalise(html: str) -> str:
    """Page text with the parts that change on every load removed, so a hash change means a content change."""
    html = re.sub(r"(?is)<(script|style|noscript|svg|head|nav|footer|header)\b.*?</\1>", " ", html)
    html = re.sub(r"(?s)<!--.*?-->", " ", html)
    text = unescape(re.sub(r"(?s)<[^>]+>", " ", html))
    text = re.sub(r"(?i)(last (updated|modified|reviewed)|updated on|page generated|copyright|©)[^.\n]{0,60}", " ", text)
    text = re.sub(r"\b\d{1,2}:\d{2}(:\d{2})?\b", " ", text)  # clocks
    text = re.sub(r"[ \t\r\f\v]+", " ", text)
    lines = [ln.strip() for ln in re.split(r"[\n]+|(?<=[.!?])\s+", text) if len(ln.strip()) > 20]
    return "\n".join(lines)


def fetch(url: str):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "text/html,application/xhtml+xml,application/pdf;q=0.8"})
    try:
        with urllib.request.urlopen(req, timeout=25) as r:
            ctype = r.headers.get("Content-Type", "")
            body = r.read(MAX_BYTES)
    except urllib.error.HTTPError as e:
        return None, f"http {e.code}"
    except Exception as e:  # DNS, TLS, timeout
        return None, f"error {type(e).__name__}"
    if "pdf" in ctype.lower() or url.lower().endswith(".pdf"):
        return None, "pdf (not diffed)"
    text = normalise(body.decode("utf-8", errors="replace"))
    if len(text) < 200:
        return None, "unreadable (script-rendered or empty)"
    return text, "ok"


def load_state():
    if STATE.exists():
        return json.loads(STATE.read_text())
    return {}


def sources():
    """url -> list of 'passport->destination[ via doc]' labels, from the seed."""
    out = {}
    for r in json.loads(SEED.read_text()):
        label = f"{r['passport_country']}->{r['destination_country']}" + (f" via {r['requires_held_document_country']}" if r.get("requires_held_document_country") else "")
        out.setdefault(r["source_url"], {"rules": [], "dests": set()})
        out[r["source_url"]]["rules"].append(label)
        out[r["source_url"]]["dests"].add(r["destination_country"])
    return out


def triage(diff_text: str, rules: list[str]):
    key = os.environ.get("ANTHROPIC_API_KEY")
    if not key:
        return None
    body = json.dumps({
        "model": os.environ.get("MONITOR_MODEL", "claude-haiku-5-5"),
        "max_tokens": 400,
        "messages": [{"role": "user", "content":
            "A government page behind these visa rules changed. Rules: " + "; ".join(rules[:12]) +
            "\n\nUnified diff of the page text (old -> new):\n" + diff_text[:6000] +
            "\n\nAnswer with JSON only: {\"material\": true|false, \"why\": \"one sentence\", \"quoted_change\": \"the changed sentence, verbatim\"}. "
            "material=true only if the change could alter entry requirements, stay length, fees, validity or dates."}],
    }).encode()
    req = urllib.request.Request("https://api.anthropic.com/v1/messages", data=body, headers={
        "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=40) as r:
            data = json.loads(r.read())
        return data["content"][0]["text"].strip()
    except Exception as e:
        return f"(triage unavailable: {type(e).__name__})"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--tier", choices=["A", "all"], default="all")
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--report", default="monitor/report.md")
    args = ap.parse_args()

    STATE_DIR.mkdir(exist_ok=True)
    SNAP.mkdir(exist_ok=True)
    state = load_state()
    srcs = sources()
    urls = [u for u, v in srcs.items() if args.tier == "all" or (v["dests"] & TIER_A)]
    urls.sort()
    if args.limit:
        urls = urls[: args.limit]

    changed, unreadable, new, ok = [], [], 0, 0
    for i, url in enumerate(urls, 1):
        key = hashlib.sha1(url.encode()).hexdigest()[:16]
        text, status = fetch(url)
        entry = state.get(url, {})
        entry["checked"] = now()
        entry["status"] = status
        if text is None:
            unreadable.append((url, status))
            state[url] = entry
            continue
        ok += 1
        h = hashlib.sha256(text.encode()).hexdigest()
        snap = SNAP / f"{key}.txt"
        if entry.get("hash") and entry["hash"] != h and snap.exists():
            old = snap.read_text().splitlines()
            diff = "\n".join(list(difflib.unified_diff(old, text.splitlines(), "before", "after", lineterm="", n=1))[:160])
            entry["changed"] = now()
            changed.append((url, srcs[url]["rules"], diff, triage(diff, srcs[url]["rules"])))
        elif not entry.get("hash"):
            new += 1
        entry["hash"] = h
        snap.write_text(text)
        state[url] = entry
        time.sleep(0.5)  # be polite to government servers
        if i % 25 == 0:
            print(f"  {i}/{len(urls)}", file=sys.stderr)

    STATE.write_text(json.dumps(state, indent=1, sort_keys=True))
    lines = [f"# Source monitor, {now()}", "", f"Watched {len(urls)} pages: {ok} readable, {len(unreadable)} not readable, {new} first-time baselines, **{len(changed)} changed**.", ""]
    if changed:
        lines.append("## Changed pages (open each one; a change is a lead, not a verdict)")
        for url, rules, diff, tri in changed:
            lines += ["", f"### {url}", f"Rules that rest on it ({len(rules)}): " + "; ".join(rules[:10]) + (" ..." if len(rules) > 10 else "")]
            if tri:
                lines += ["", "Triage (a model's hint, check the page yourself):", "", "```", tri, "```"]
            lines += ["", "```diff", diff[:3500], "```"]
    if unreadable:
        lines += ["", f"## Not watched this run ({len(unreadable)}): blocked, scripted or PDF", ""]
        lines += [f"- {u} ({s})" for u, s in unreadable[:80]]
    Path(args.report).write_text("\n".join(lines) + "\n")
    print(f"changed={len(changed)} readable={ok} unreadable={len(unreadable)} baselines={new}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
