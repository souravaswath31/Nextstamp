import maplibreGlPackage from "maplibre-gl/package.json";

let workerUrlSet = false;

/**
 * Loads maplibre-gl and makes sure its worker will actually load.
 *
 * Without this, the map LOOKS like it's working — the pins show up, the
 * MapTiler attribution is there — but there are no roads, labels, borders, or
 * terrain, just the style's flat background colour. The browser console shows
 * why: `Worker failed to load` and `Failed to load module script: ... MIME
 * type of "text/html"`. maplibre-gl v3+ spins up its own Web Worker (via
 * `new Worker(new URL(...), { type: "module" })`) to parse vector tile data —
 * every actual map *feature* is rendered from what that worker produces.
 * Markers are plain DOM elements and the background is a static style colour,
 * so both render fine without it, which is exactly what makes this failure
 * mode easy to miss on a glance.
 *
 * Root cause: when maplibre-gl is `import()`-ed dynamically from inside a
 * "use client" component's effect (done here so its ~200KB doesn't land in
 * every page's bundle), Next.js's webpack config does not correctly emit the
 * library's own worker chunk as a servable static asset. The worker's request
 * 404s, Next's catch-all route returns the 404 page as HTML, and the browser
 * refuses to execute HTML as a JS module.
 *
 * Fix: point the worker at jsDelivr instead of whatever Next tried to bundle.
 * jsDelivr serves the file with the correct JS MIME type and CORS headers, so
 * the worker loads regardless of how the bundler handled the dynamic import.
 * The version comes from the installed package's own package.json rather than
 * a hardcoded string, so it can never drift from what's actually running on
 * the main thread — a mismatch there can break the worker's message protocol.
 */
export async function loadMapLibre() {
  const maplibre = await import("maplibre-gl");
  if (!workerUrlSet) {
    maplibre.setWorkerUrl(
      `https://cdn.jsdelivr.net/npm/maplibre-gl@${maplibreGlPackage.version}/dist/maplibre-gl-worker.mjs`
    );
    workerUrlSet = true;
  }
  return maplibre;
}

/** MapTiler style URL. The app is dark, so maps default to the dark Outdoor style. */
export function mapStyleUrl(apiKey: string, variant: "dark" | "light" = "dark") {
  const id = variant === "dark" ? "outdoor-v2-dark" : "outdoor-v2";
  return `https://api.maptiler.com/maps/${id}/style.json?key=${apiKey}`;
}

/**
 * If the dark style cannot be loaded (a plan or key that doesn't include it, a 403),
 * fall back to the light one rather than leaving a blank map. Only reacts to errors
 * before the first load, so a single failed tile later never swaps the style.
 */
export function fallBackToLightStyle(
  map: { once: (e: string, cb: () => void) => void; setStyle: (url: string) => void },
  apiKey: string
) {
  let loaded = false;
  map.once("load", () => {
    loaded = true;
  });
  map.once("error", () => {
    if (!loaded) map.setStyle(mapStyleUrl(apiKey, "light"));
  });
}
