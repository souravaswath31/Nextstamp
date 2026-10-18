#!/usr/bin/env python3
"""Import the generated itinerary/country images from a folder you downloaded from Drive.

    python3 scripts/import_images.py <folder> [--dry-run]

For every file in <folder> whose name (minus .jpg/.jpeg/.png) is an itinerary slug or a country
slug, center-crops it to 8:3, resizes to 1600x600 and saves it as a compressed JPG in
public/itineraries/ or public/countries/. Uses macOS `sips`. Reports files it did not recognise and
slugs that are still missing. Then run `python3 scripts/apply_new_images.py`.
"""
import json
import re
import subprocess
import sys
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
from apply_new_images import ROUND5, ROUND5_COUNTRIES, slugify  # noqa: E402

W, H = 1600, 600


def sh(*a):
    return subprocess.run(a, capture_output=True, text=True)


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    dry = "--dry-run" in sys.argv
    if not args:
        print(__doc__)
        return 1
    src = Path(args[0]).expanduser()
    its = {slugify(t): t for t in ROUND5}
    countries = set(ROUND5_COUNTRIES)
    done, unknown, bad = [], [], []
    for f in sorted(src.iterdir()):
        if f.suffix.lower() not in (".jpg", ".jpeg", ".png"):
            continue
        name = f.stem
        if name in its:
            dest = ROOT / "public" / "itineraries" / f"{name}.jpg"
        elif name in countries:
            dest = ROOT / "public" / "countries" / f"{name}.jpg"
        else:
            unknown.append(f.name)
            continue
        if dry:
            done.append(name)
            continue
        tmp = dest.with_suffix(".tmp.jpg")
        # scale so both sides cover 1600x600, then crop the centre
        info = sh("sips", "-g", "pixelWidth", "-g", "pixelHeight", str(f)).stdout
        w = int(re.search(r"pixelWidth: (\d+)", info).group(1))
        h = int(re.search(r"pixelHeight: (\d+)", info).group(1))
        scale = max(W / w, H / h)
        nw, nh = round(w * scale), round(h * scale)
        r = sh("sips", "-s", "format", "jpeg", "-s", "formatOptions", "78", "-z", str(nh), str(nw), str(f), "--out", str(tmp))
        r2 = sh("sips", "-c", str(H), str(W), str(tmp), "--out", str(dest))
        tmp.unlink(missing_ok=True)
        if r.returncode or r2.returncode or not dest.exists():
            bad.append(f"{f.name}: {(r.stderr or r2.stderr).strip()[:100]}")
            continue
        done.append(f"{name} ({w}x{h} -> {W}x{H}, {dest.stat().st_size // 1000} KB)")
    print(f"{len(done)} imported")
    for d in done:
        print("  ok  ", d)
    for u in unknown:
        print("  skip (not a known slug):", u)
    for b in bad:
        print("  FAIL ", b)
    have = {Path(d.split(" ")[0]).name for d in done}
    missing = [s for s in list(its) + sorted(countries) if s not in have and not any(
        (ROOT / "public" / k / f"{s}.jpg").exists() for k in ("itineraries", "countries"))]
    print(f"{len(missing)} still missing" + (": " + ", ".join(missing) if missing else ""))
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
