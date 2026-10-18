#!/usr/bin/env python3
"""Fetch every public page of the live site and report what is broken.

    python3 scripts/smoke_crawl.py [base_url] [out.json]

Reads <base>/sitemap.xml plus a fixed list of other public routes, GETs each page (8 at a time),
and flags: a non-200 status, an error marker in the HTML, a missing <title>/<h1>, and any <img> or
CSS background image that does not come back 200 with an image content type. Pages behind a login
redirect to /login and are reported as such, not as failures. Writes full detail to out.json and
prints a summary. Needs network access (run it on your own machine).
"""
import json
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor

BASE = (sys.argv[1] if len(sys.argv) > 1 else "https://nextstamp-app.vercel.app").rstrip("/")
OUT = sys.argv[2] if len(sys.argv) > 2 else "smoke_crawl.json"
EXTRA = ["/", "/login", "/states", "/explore", "/countries", "/pricing", "/about", "/terms", "/privacy",
         "/flights", "/hotels", "/activities", "/features/visa-check", "/features/trip-from-a-link",
         "/does-not-exist-404-check"]
ERROR_MARKERS = ["Application error", "Internal Server Error", "This page could not be found", "Unhandled Runtime Error", "Server Error"]
UA = {"User-Agent": "NextStampSmokeCrawl/1.0"}


def get(url, binary=False):
    req = urllib.request.Request(url, headers=UA)
    try:
        with urllib.request.urlopen(req, timeout=40) as r:
            body = r.read()
            return r.status, r.headers.get("content-type", ""), (body if binary else body.decode("utf-8", "replace")), r.geturl()
    except urllib.error.HTTPError as e:
        return e.code, e.headers.get("content-type", "") if e.headers else "", "", url
    except Exception as e:  # noqa: BLE001
        return 0, "", f"{type(e).__name__}: {e}", url


def sitemap_urls():
    st, _, body, _ = get(BASE + "/sitemap.xml")
    if st != 200:
        return []
    return [re.sub(r"^https?://[^/]+", "", u) or "/" for u in re.findall(r"<loc>([^<]+)</loc>", body)]


def image_urls(html):
    urls = set(re.findall(r'<img[^>]+src="([^"]+)"', html))
    urls |= set(re.findall(r"url\(['\"]?([^)'\"]+)['\"]?\)", html))
    urls |= set(re.findall(r'<meta property="og:image" content="([^"]+)"', html))
    return {urllib.parse.urljoin(BASE + "/", u.replace("&amp;", "&")) for u in urls if not u.startswith("data:")}


def check_page(path):
    st, ct, html, final = get(BASE + path)
    res = {"path": path, "status": st, "final": final.replace(BASE, "") or "/", "problems": [], "images": []}
    if path == "/does-not-exist-404-check":
        if st != 404:
            res["problems"].append(f"unknown route returned {st}, expected 404")
        return res
    if st != 200:
        res["problems"].append(f"status {st}" + (f" ({html[:120]})" if st == 0 else ""))
        return res
    if "/login" in res["final"] and path != "/login":
        res["redirected_to_login"] = True
        return res
    for m in ERROR_MARKERS:
        if m in html:
            res["problems"].append(f"error marker: {m}")
    if not re.search(r"<title>[^<]{3,}</title>", html):
        res["problems"].append("no <title>")
    if "<h1" not in html:
        res["problems"].append("no <h1>")
    res["images"] = sorted(image_urls(html))
    return res


def check_image(url):
    st, ct, body, _ = get(url, binary=True)
    ok = st == 200 and ct.startswith("image/") and len(body) > 500
    return url, ok, st, ct, len(body) if isinstance(body, bytes) else 0


def main():
    paths = []
    for p in EXTRA + sitemap_urls():
        if p not in paths:
            paths.append(p)
    print(f"{len(paths)} pages")
    with ThreadPoolExecutor(8) as ex:
        pages = list(ex.map(check_page, paths))
    imgs = sorted({u for p in pages for u in p["images"]})
    print(f"{len(imgs)} distinct images")
    with ThreadPoolExecutor(8) as ex:
        img_results = {u: (ok, st, ct, n) for u, ok, st, ct, n in ex.map(check_image, imgs)}
    for p in pages:
        for u in p["images"]:
            ok, st, ct, n = img_results[u]
            if not ok:
                p["problems"].append(f"image broken ({st} {ct}): {u.replace(BASE, '')}")
    bad = [p for p in pages if p["problems"]]
    json.dump({"pages": pages, "images": {u: list(v) for u, v in img_results.items()}}, open(OUT, "w"), indent=1)
    print(f"\n{len(pages) - len(bad)} pages OK, {len(bad)} with problems, "
          f"{sum(1 for p in pages if p.get('redirected_to_login'))} redirected to login")
    for p in bad:
        print(f"\n{p['path']}  [{p['status']}]")
        for pr in p["problems"]:
            print("   -", pr)
    broken = [u for u, v in img_results.items() if not v[0]]
    print(f"\nBroken images: {len(broken)}")


if __name__ == "__main__":
    main()
