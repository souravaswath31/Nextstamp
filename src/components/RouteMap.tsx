"use client";

import { useEffect, useRef, useState } from "react";
import { Route } from "lucide-react";
import "maplibre-gl/dist/maplibre-gl.css";

/**
 * A trip or itinerary drawn as an ordered route: numbered pins in day order,
 * joined by a line.
 *
 * Distinct from PlaceMap, which shows an unordered set of places coloured by
 * category. The semantics here are sequence — day 1 then day 2 — so the pins
 * are numbered and connected, and the numbering follows the *day*, not the
 * pin index, so a gap reads honestly: if day 3 couldn't be geocoded the line
 * runs 2 → 4 rather than silently renumbering and implying a route that skips
 * nothing.
 *
 * Coordinates come from the seed data (scripts/geocode_itineraries.py). Days
 * whose title is an activity rather than a place ("Rest day", "Fly home") have
 * no coordinates by design and are listed under the map instead of guessed at.
 */

export type RouteStop = {
  dayNumber: number;
  title: string;
  latitude: number;
  longitude: number;
};

export default function RouteMap({
  stops,
  /** Days with no coordinates — named under the map rather than dropped. */
  unmappedCount = 0,
  heading = "The route",
}: {
  stops: RouteStop[];
  unmappedCount?: number;
  heading?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const apiKey = process.env.NEXT_PUBLIC_MAPTILER_KEY;

  useEffect(() => {
    if (!apiKey || stops.length === 0 || !containerRef.current) return;

    let map: { remove: () => void } | null = null;
    let cancelled = false;

    (async () => {
      try {
        const maplibre = await import("maplibre-gl");
        if (cancelled || !containerRef.current) return;

        const lons = stops.map((s) => s.longitude);
        const lats = stops.map((s) => s.latitude);
        const instance = new maplibre.Map({
          container: containerRef.current,
          style: `https://api.maptiler.com/maps/outdoor-v2/style.json?key=${apiKey}`,
          bounds: [
            [Math.min(...lons), Math.min(...lats)],
            [Math.max(...lons), Math.max(...lats)],
          ],
          fitBoundsOptions: { padding: 60, maxZoom: 10 },
          attributionControl: { compact: true },
        });
        map = instance;
        instance.addControl(new maplibre.NavigationControl({ showCompass: false }), "top-right");

        instance.on("load", () => {
          if (cancelled || stops.length < 2) return;
          // A straight line between stops, explicitly NOT a driving route —
          // we have no routing data and drawing one would imply a road that
          // may not exist. Dashed, so it reads as "order" not "directions".
          instance.addSource("route", {
            type: "geojson",
            data: {
              type: "Feature",
              properties: {},
              geometry: {
                type: "LineString",
                coordinates: stops.map((s) => [s.longitude, s.latitude]),
              },
            },
          });
          instance.addLayer({
            id: "route-line",
            type: "line",
            source: "route",
            layout: { "line-cap": "round", "line-join": "round" },
            paint: {
              "line-color": "#FF5A5F",
              "line-width": 2.5,
              "line-opacity": 0.75,
              "line-dasharray": [2, 1.5],
            },
          });
        });

        for (const stop of stops) {
          const el = document.createElement("div");
          el.textContent = String(stop.dayNumber);
          el.style.cssText = [
            "width:24px", "height:24px", "border-radius:9999px",
            "background:#FF5A5F", "color:#fff", "border:2.5px solid #fff",
            "box-shadow:0 1px 5px rgba(0,0,0,0.35)",
            "font:600 11px/21px ui-sans-serif,system-ui,sans-serif",
            "text-align:center", "cursor:pointer",
          ].join(";");
          el.setAttribute("aria-label", `Day ${stop.dayNumber}: ${stop.title}`);

          new maplibre.Marker({ element: el })
            .setLngLat([stop.longitude, stop.latitude])
            .setPopup(
              new maplibre.Popup({ offset: 18, closeButton: false }).setHTML(
                `<strong style="font-size:13px">Day ${stop.dayNumber}</strong><br>` +
                  `<span style="font-size:12px">${escapeHtml(stop.title)}</span>`
              )
            )
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
  }, [apiKey, stops]);

  if (stops.length === 0) return null;

  return (
    <section className="rounded-panel bg-paper p-5 shadow-paper">
      <h2 className="flex items-center gap-2 font-display text-lg text-ink">
        <Route size={17} className="text-ink/35" /> {heading}
      </h2>

      {!apiKey ? (
        <p className="mt-3 rounded-card bg-paperDark px-4 py-3 font-body text-sm text-ink/60">
          The map needs a MapTiler key. Add{" "}
          <code className="font-stamp text-xs">NEXT_PUBLIC_MAPTILER_KEY</code> to the
          environment and this route appears — {stops.length} stop
          {stops.length === 1 ? " is" : "s are"} already geocoded and waiting.
        </p>
      ) : failed ? (
        <p className="mt-3 rounded-card bg-paperDark px-4 py-3 font-body text-sm text-ink/60">
          The map couldn&apos;t load. The day-by-day plan below is the same content.
        </p>
      ) : (
        <>
          <div
            ref={containerRef}
            className="mt-3 h-[24rem] w-full overflow-hidden rounded-card bg-paperDark"
            role="application"
            aria-label={heading}
          />
          <p className="mt-2.5 font-body text-xs text-ink/45">
            Pins are numbered by day. The line shows the order you travel in, not a driving
            route — we don&apos;t have road data and won&apos;t draw a road that might not exist.
          </p>
        </>
      )}

      {unmappedCount > 0 && (
        <p className="mt-2 font-body text-xs text-ink/45">
          {unmappedCount} day{unmappedCount === 1 ? "" : "s"} aren&apos;t pinned — those are
          rest days, travel days, or stops we couldn&apos;t place confidently.
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
