"use client";

import { useEffect, useRef, useState } from "react";
import { MapPinned } from "lucide-react";
// MapLibre's own stylesheet. Imported statically because Next.js handles CSS
// imports from client components and scopes them to the routes that use them;
// a dynamic import() of CSS has no types and buys nothing here.
import "maplibre-gl/dist/maplibre-gl.css";

// Map of a state guide's places.
//
// MapLibre GL (open source, no account) rendering MapTiler tiles (free key, no
// credit card, 5k map sessions/month). Two things the roadmap research settled
// and that are easy to get wrong later:
//   • Raw OpenStreetMap tiles are NOT permitted at app scale — OSMF's tile
//     usage policy is for development and small projects only. Hence a tile
//     provider.
//   • Google Maps now requires a billing account even inside the free tier.
//
// Coordinates come from the seed data, geocoded once at authoring time by
// scripts/geocode_places.py. Places that couldn't be resolved have null
// coordinates and are simply left off the map — never approximated.
//
// The library is loaded dynamically so its ~200KB doesn't land in the bundle
// for the many pages that don't show a map.

export type MapPlace = {
  id: string;
  name: string;
  category: string;
  latitude: number;
  longitude: number;
  nearestTown: string | null;
};

const CATEGORY_COLORS: Record<string, string> = {
  amazing: "#2FA84F",
  common: "#FF5A5F",
  hidden: "#06B6D4",
  food_culture: "#F5A623",
};

const CATEGORY_LABELS: Record<string, string> = {
  amazing: "Amazing places",
  common: "Most common",
  hidden: "Hidden gems",
  food_culture: "Food & culture",
};

export default function PlaceMap({
  places,
  title,
  /** Count of places we couldn't geocode, so the UI can be honest about it. */
  omittedCount = 0,
}: {
  places: MapPlace[];
  title: string;
  omittedCount?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const apiKey = process.env.NEXT_PUBLIC_MAPTILER_KEY;

  useEffect(() => {
    if (!apiKey || places.length === 0 || !containerRef.current) return;

    let map: { remove: () => void } | null = null;
    let cancelled = false;

    (async () => {
      try {
        // The library itself is still loaded lazily — it's ~200KB and most
        // pages never show a map.
        const maplibre = await import("maplibre-gl");
        if (cancelled || !containerRef.current) return;

        const lats = places.map((p) => p.latitude);
        const lons = places.map((p) => p.longitude);
        const bounds: [[number, number], [number, number]] = [
          [Math.min(...lons), Math.min(...lats)],
          [Math.max(...lons), Math.max(...lats)],
        ];

        const instance = new maplibre.Map({
          container: containerRef.current,
          style: `https://api.maptiler.com/maps/outdoor-v2/style.json?key=${apiKey}`,
          bounds,
          fitBoundsOptions: { padding: 56, maxZoom: 11 },
          attributionControl: { compact: true },
        });
        map = instance;

        instance.addControl(new maplibre.NavigationControl({ showCompass: false }), "top-right");

        for (const place of places) {
          const el = document.createElement("div");
          el.style.cssText = [
            "width:14px", "height:14px", "border-radius:9999px",
            `background:${CATEGORY_COLORS[place.category] ?? "#1D1D1F"}`,
            "border:2.5px solid #fff",
            "box-shadow:0 1px 4px rgba(0,0,0,0.3)",
            "cursor:pointer",
          ].join(";");
          el.setAttribute("aria-label", place.name);

          const popup = new maplibre.Popup({ offset: 14, closeButton: false }).setHTML(
            `<strong style="font-size:13px">${escapeHtml(place.name)}</strong>` +
              (place.nearestTown
                ? `<br><span style="font-size:11px;opacity:.65">Near ${escapeHtml(place.nearestTown)}</span>`
                : "")
          );

          new maplibre.Marker({ element: el })
            .setLngLat([place.longitude, place.latitude])
            .setPopup(popup)
            .addTo(instance);
        }
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [apiKey, places]);

  if (places.length === 0) return null;

  const categoriesShown = Array.from(new Set(places.map((p) => p.category)));

  return (
    <section className="rounded-panel bg-paper p-5 shadow-paper">
      <h2 className="flex items-center gap-2 font-display text-lg text-ink">
        <MapPinned size={17} className="text-ink/35" /> {title} on a map
      </h2>

      {!apiKey ? (
        <p className="mt-3 rounded-card bg-paperDark px-4 py-3 font-body text-sm text-ink/60">
          The map needs a MapTiler key. Add <code className="font-stamp text-xs">NEXT_PUBLIC_MAPTILER_KEY</code>{" "}
          to the environment and it appears here — {places.length} place
          {places.length === 1 ? "" : "s"} are already geocoded and waiting.
        </p>
      ) : failed ? (
        <p className="mt-3 rounded-card bg-paperDark px-4 py-3 font-body text-sm text-ink/60">
          The map couldn&apos;t load. Everything on this page still works — the list below is
          the same content.
        </p>
      ) : (
        <>
          <div
            ref={containerRef}
            className="mt-3 h-[22rem] w-full overflow-hidden rounded-card bg-paperDark"
            role="application"
            aria-label={`Map of places in ${title}`}
          />
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
            {categoriesShown.map((c) => (
              <span key={c} className="flex items-center gap-1.5 font-body text-xs text-ink/55">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ background: CATEGORY_COLORS[c] ?? "#1D1D1F" }}
                />
                {CATEGORY_LABELS[c] ?? c}
              </span>
            ))}
          </div>
        </>
      )}

      {omittedCount > 0 && (
        <p className="mt-2.5 font-body text-xs text-ink/45">
          {omittedCount} place{omittedCount === 1 ? " isn't" : "s aren't"} shown — we couldn&apos;t
          find {omittedCount === 1 ? "it" : "them"} in OpenStreetMap, and a pin in roughly the
          right area would be worse than none.
        </p>
      )}
    </section>
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
