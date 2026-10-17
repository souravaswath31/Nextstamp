import { describe, expect, it } from "vitest";
import { allowedRedirectTarget, oembedEndpoint, parseSourceUrl } from "./sourceUrl";
import { decodeEntities, extractMeta, readSourceUrl } from "./source";
import { cleanLabel, normalize, quoteIsInSource, validateExtraction } from "./extraction";
import { formatDrive, groupIntoDays, orderStops } from "./order";
import { parseGeocodeResponse, parseMatrixResponse, haversineKm } from "./geo";
import { matchGuidePlace, suggestFromGuide, type GuidePlace } from "./guideMatch";
import { buildOrdering, routable, type DraftStop } from "./plan";
import { analyzeSource, type Deps } from "./analyze";

describe("parseSourceUrl", () => {
  it("accepts the three platforms and adds https when missing", () => {
    expect(parseSourceUrl("https://www.youtube.com/watch?v=abc")).toMatchObject({ ok: true, platform: "youtube" });
    expect(parseSourceUrl("youtu.be/abc")).toMatchObject({ ok: true, platform: "youtube" });
    expect(parseSourceUrl("https://vm.tiktok.com/ZMabc/")).toMatchObject({ ok: true, platform: "tiktok" });
    expect(parseSourceUrl("instagram.com/reel/xyz/")).toMatchObject({ ok: true, platform: "instagram" });
  });
  it("rejects everything that could point the server somewhere else", () => {
    for (const bad of [
      "http://www.youtube.com/watch?v=1",
      "https://evil.com/youtube.com",
      "https://youtube.com.evil.com/x",
      "https://user:pw@www.youtube.com/x",
      "https://www.youtube.com:8443/x",
      "https://127.0.0.1/x",
      "https://localhost/x",
      "https://169.254.169.254/latest/meta-data",
      "file:///etc/passwd",
      "javascript:alert(1)",
      "",
    ]) {
      expect(parseSourceUrl(bad).ok, bad).toBe(false);
    }
  });
  it("re-checks redirect targets against the same list", () => {
    const from = new URL("https://vm.tiktok.com/abc");
    expect(allowedRedirectTarget(from, "https://www.tiktok.com/@a/video/1")).not.toBeNull();
    expect(allowedRedirectTarget(from, "/@a/video/1")).not.toBeNull();
    expect(allowedRedirectTarget(from, "https://evil.com/")).toBeNull();
    expect(allowedRedirectTarget(from, "http://www.tiktok.com/")).toBeNull();
    expect(allowedRedirectTarget(from, "https://169.254.169.254/")).toBeNull();
  });
  it("has oEmbed for YouTube and TikTok only", () => {
    const u = new URL("https://www.youtube.com/watch?v=abc");
    expect(oembedEndpoint("youtube", u)).toContain("https://www.youtube.com/oembed?");
    expect(oembedEndpoint("instagram", u)).toBeNull();
  });
});

describe("readSourceUrl", () => {
  const html = `<html><head><meta property="og:title" content="Utah road trip &amp; Moab"><meta name="description" content="Day 1 Arches National Park, then Delicate Arch at sunset."></head></html>`;
  const fakeFetch = (routes: Record<string, () => Response>) =>
    (async (input: RequestInfo | URL) => {
      const u = String(input);
      const key = Object.keys(routes).find((k) => u.startsWith(k));
      if (!key) throw new Error("unexpected fetch " + u);
      return routes[key]();
    }) as typeof fetch;

  it("combines oEmbed with public meta tags", async () => {
    const f = fakeFetch({
      "https://www.youtube.com/oembed": () => new Response(JSON.stringify({ title: "Utah in 5 days", author_name: "Sam" })),
      "https://www.youtube.com/watch": () => new Response(html),
    });
    const r = await readSourceUrl("https://www.youtube.com/watch?v=abc", f);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.source.text).toContain("Utah in 5 days");
      expect(r.source.text).toContain("Arches National Park");
      expect(r.source.author).toBe("Sam");
    }
  });
  it("refuses a redirect that leaves the allowlist", async () => {
    const f = fakeFetch({
      "https://vm.tiktok.com/abc": () => new Response(null, { status: 302, headers: { location: "https://evil.com/steal" } }),
      "https://www.tiktok.com/oembed": () => new Response("{}", { status: 404 }),
    });
    const r = await readSourceUrl("https://vm.tiktok.com/abc", f);
    expect(r.ok).toBe(false);
  });
  it("says so when nothing readable comes back", async () => {
    const f = fakeFetch({ "https://www.instagram.com/reel/x": () => new Response("<html><title>Login</title></html>") });
    const r = await readSourceUrl("https://www.instagram.com/reel/x", f);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/paste the caption/i);
  });
  it("decodes entities and finds meta in either attribute order", () => {
    expect(decodeEntities("A &amp; B &#39;x&#39; &#x1F600;")).toBe("A & B 'x' 😀");
    expect(extractMeta(`<meta content="Hi there" property="og:description">`).description).toBe("Hi there");
  });
});

describe("extraction validation", () => {
  const source = "Day 1: Arches National Park — we hiked to Delicate Arch at sunrise. Then dinner in Moab.";
  it("keeps places whose quote is in the source and drops the rest", () => {
    const e = validateExtraction(
      {
        destination_country: "united states",
        places: [
          { name: "Delicate Arch", quote: "hiked to Delicate Arch at sunrise" },
          { name: "Zion National Park", quote: "we loved Zion" }, // quote not in source
          { name: "Bryce Canyon", quote: "" }, // no quote
          { name: "Moab", quote: "dinner in Moab" },
          { name: "moab", quote: "dinner in Moab" }, // duplicate
        ],
      },
      source
    );
    expect(e.places.map((p) => p.name)).toEqual(["Delicate Arch", "Moab"]);
    expect(e.dropped.map((d) => d.name)).toEqual(["Zion National Park", "Bryce Canyon"]);
    expect(e.destinationCountry).toBe("united states");
  });
  it("drops a place whose real quote is there but whose name is not", () => {
    const e = validateExtraction({ places: [{ name: "Grand Canyon", quote: "dinner in Moab" }] }, source);
    expect(e.places).toEqual([]);
    expect(e.dropped[0].reason).toMatch(/name not found/);
  });
  it("cannot check quotes for screenshots, so it keeps the model's places", () => {
    const e = validateExtraction({ places: [{ name: "Delicate Arch", quote: "x" }] }, null);
    expect(e.places).toHaveLength(1);
  });
  it("survives garbage and strips links and control characters", () => {
    expect(validateExtraction("nope", "x").places).toEqual([]);
    expect(validateExtraction({ places: [null, 3, {}] }, "x").places).toEqual([]);
    expect(cleanLabel("Hi\u0000 https://evil.com/x  there", 50)).toBe("Hi there");
    expect(validateExtraction({ places: Array.from({ length: 40 }, (_, i) => ({ name: `Place ${i}`, quote: `Place ${i}` })) }, Array.from({ length: 40 }, (_, i) => `Place ${i}`).join(" ")).places).toHaveLength(15);
  });
  it("normalizes accents and punctuation for the substring check", () => {
    expect(normalize("Café  Del-Mar!")).toBe("cafe del mar");
    expect(quoteIsInSource("cafe del mar", "We ate at Café Del Mar.")).toBe(true);
    expect(quoteIsInSource("hi", "hi there")).toBe(false); // too short to mean anything
  });
});

describe("ordering", () => {
  // Four towns on a line: 0 - 1 - 2 - 3, each leg an hour, longer legs sum.
  const line = [0, 1, 2, 3].map((i) => [0, 1, 2, 3].map((j) => Math.abs(i - j) * 3600));
  it("finds the shortest open path regardless of mention order", () => {
    // Mentioned order 1,3,0,2 -> best path is 0,1,2,3 (or reverse).
    const sh = [1, 3, 0, 2];
    const m = sh.map((a) => sh.map((b) => Math.abs(a - b) * 3600));
    const order = orderStops(m)!;
    const towns = order.map((i) => sh[i]);
    expect(towns[0] === 0 ? towns : [...towns].reverse()).toEqual([0, 1, 2, 3]);
  });
  it("keeps the post's own order when drive times tie", () => {
    const flat = [0, 1, 2].map((i) => [0, 1, 2].map((j) => (i === j ? 0 : 3600)));
    expect(orderStops(flat)).toEqual([0, 1, 2]);
  });
  it("returns null if any pair has no route", () => {
    const m = [[0, null], [null, 0]];
    expect(orderStops(m)).toBeNull();
  });
  it("handles more stops than the exact search covers", () => {
    const n = 10;
    const m = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => Math.abs(i - j) * 1800));
    const order = orderStops(m)!;
    expect(new Set(order).size).toBe(n);
    const total = order.slice(1).reduce((s, v, k) => s + m[order[k]][v], 0);
    expect(total).toBe((n - 1) * 1800); // optimal on a line
  });
  it("cuts days on drive time and stop count, counting the leg in from the previous day", () => {
    const m = line;
    expect(groupIntoDays([0, 1, 2, 3], m).map((d) => d.stops)).toEqual([[0, 1, 2, 3]]);
    const long = [0, 1, 2].map((i) => [0, 1, 2].map((j) => Math.abs(i - j) * 3 * 3600));
    const days = groupIntoDays([0, 1, 2], long);
    expect(days.map((d) => d.stops)).toEqual([[0, 1], [2]]);
    expect(days[1].driveSeconds).toBe(3 * 3600); // arrival leg lands on day 2
    const many = Array.from({ length: 6 }, (_, i) => Array.from({ length: 6 }, (_, j) => Math.abs(i - j) * 600));
    expect(groupIntoDays([0, 1, 2, 3, 4, 5], many).map((d) => d.stops.length)).toEqual([4, 2]);
  });
  it("formats drive time like the seeded itineraries", () => {
    expect(formatDrive(2.5 * 3600)).toBe("2.5 hrs");
    expect(formatDrive(3 * 3600)).toBe("3 hrs");
    expect(formatDrive(3600)).toBe("1 hr");
    expect(formatDrive(10 * 60)).toBeNull();
  });
});

describe("provider responses", () => {
  it("accepts a confident geocode and rejects a weak or malformed one", () => {
    expect(parseGeocodeResponse({ features: [{ center: [-109.5, 38.7], relevance: 0.95, place_name: "Delicate Arch, Utah" }] })).toMatchObject({ lat: 38.7, lng: -109.5 });
    expect(parseGeocodeResponse({ features: [{ center: [-109.5, 38.7], relevance: 0.4 }] })).toBeNull();
    expect(parseGeocodeResponse({ features: [{ center: [999, 38.7], relevance: 0.9 }] })).toBeNull();
    expect(parseGeocodeResponse({ features: [] })).toBeNull();
    expect(parseGeocodeResponse(null)).toBeNull();
  });
  it("validates the matrix shape", () => {
    expect(parseMatrixResponse({ durations: [[0, 5], [6, 0]] }, 2)).toEqual([[0, 5], [6, 0]]);
    expect(parseMatrixResponse({ durations: [[0, null], [6, 0]] }, 2)![0][1]).toBeNull();
    expect(parseMatrixResponse({ durations: [[0, 5]] }, 2)).toBeNull();
    expect(haversineKm({ lat: 0, lng: 0 }, { lat: 0, lng: 1 })).toBeCloseTo(111.2, 0);
  });
});

const guide: GuidePlace[] = [
  { name: "Delicate Arch", nearestTown: "Moab", latitude: 38.74, longitude: -109.5, stateSlug: "utah", stateName: "Utah", description: "" },
  { name: "Arches National Park", nearestTown: "Moab", latitude: 38.73, longitude: -109.59, stateSlug: "utah", stateName: "Utah", description: "" },
  { name: "Dead Horse Point", nearestTown: "Moab", latitude: 38.47, longitude: -109.74, stateSlug: "utah", stateName: "Utah", description: "" },
  { name: "Canyonlands Needles", nearestTown: "Moab", latitude: 38.18, longitude: -109.76, stateSlug: "utah", stateName: "Utah", description: "" },
  { name: "Riverside Park", nearestTown: "x", latitude: 1, longitude: 1, stateSlug: "ohio", stateName: "Ohio", description: "" },
  { name: "Riverside Park", nearestTown: "y", latitude: 2, longitude: 2, stateSlug: "iowa", stateName: "Iowa", description: "" },
];

describe("guide matching", () => {
  it("matches exact names and distinctive containment, not fragments", () => {
    expect(matchGuidePlace("delicate arch", null, guide)?.name).toBe("Delicate Arch");
    expect(matchGuidePlace("Arches National Park, Utah", null, guide)?.name).toBe("Arches National Park");
    expect(matchGuidePlace("Arch", null, guide)).toBeNull();
    expect(matchGuidePlace("Park", null, guide)).toBeNull();
  });
  it("refuses an ambiguous name unless the post names the state", () => {
    expect(matchGuidePlace("Riverside Park", null, guide)).toBeNull();
    expect(matchGuidePlace("Riverside Park", "Iowa", guide)?.stateSlug).toBe("iowa");
  });
  it("suggests only our own unmentioned places, nearest first, in one state", () => {
    const m = [guide[0]];
    const s = suggestFromGuide(m, new Set(["delicate arch"]), guide, 2);
    expect(s.map((x) => x.name)).toEqual(["Arches National Park", "Dead Horse Point"]);
    expect(suggestFromGuide([guide[0], guide[4]], new Set(), guide)).toEqual([]);
  });
});

const stop = (id: string, lat: number | null, lng: number | null): DraftStop => ({
  id, name: id, origin: "post", quote: null, area: null, lat, lng, locatedBy: lat === null ? null : "guide", guideSlug: null, note: null,
});

describe("buildOrdering", () => {
  const matrixOf = (n: number) => async () => Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => Math.abs(i - j) * 3600));
  it("orders and cuts days when routing is available", async () => {
    const stops = [stop("a", 38, -109), stop("b", 38.5, -109), stop("c", 39, -109)];
    const r = await buildOrdering(stops, matrixOf(3), true);
    expect(r.ordering.kind).toBe("ordered");
    if (r.ordering.kind === "ordered") expect(r.ordering.days.flatMap((d) => d.stopIds).sort()).toEqual(["a", "b", "c"]);
  });
  it("says so and leaves stops unordered without a routing service", async () => {
    const r = await buildOrdering([stop("a", 38, -109), stop("b", 38.5, -109)], matrixOf(2), false);
    expect(r.ordering).toMatchObject({ kind: "unordered" });
    if (r.ordering.kind === "unordered") expect(r.ordering.reason).toMatch(/routing service/);
  });
  it("does not route stops on different continents", async () => {
    const r = await buildOrdering([stop("paris", 48.8, 2.3), stop("tokyo", 35.7, 139.7)], matrixOf(2), true);
    expect(r.ordering.kind).toBe("unordered");
    expect(routable([stop("a", 0, 0)]).ok).toBe(false);
  });
  it("leaves unplaced stops out of the order and says so", async () => {
    const r = await buildOrdering([stop("a", 38, -109), stop("b", 38.5, -109), stop("x", null, null)], matrixOf(2), true);
    expect(r.notes.join(" ")).toMatch(/couldn't be placed/);
    if (r.ordering.kind === "ordered") expect(r.ordering.days.flatMap((d) => d.stopIds)).not.toContain("x");
  });
  it("falls back to unordered when the router has no answer", async () => {
    const r = await buildOrdering([stop("a", 38, -109), stop("b", 38.5, -109)], async () => null, true);
    expect(r.ordering.kind).toBe("unordered");
  });
});

describe("analyzeSource", () => {
  const baseDeps = (over: Partial<Deps> = {}): Deps => ({
    extract: async () => ({
      destinationCountry: null,
      tripTitle: "Utah weekend",
      places: [
        { name: "Delicate Arch", area: null, quote: "Delicate Arch" },
        { name: "Corona Arch", area: "Moab", quote: "Corona Arch" },
      ],
      dropped: [],
    }),
    readUrl: readSourceUrl,
    loadGuide: async () => guide,
    iso2For: async () => "us",
    geocode: async () => ({ lat: 38.58, lng: -109.63, label: "Corona Arch", relevance: 0.9 }),
    matrix: async (pts) => pts.map((_, i) => pts.map((_, j) => Math.abs(i - j) * 1800)),
    geocodingOn: true,
    routingOn: true,
    ...over,
  });

  it("matches our guide first, looks up the rest, labels every stop, and suggests only from the guide", async () => {
    const r = await analyzeSource({ mode: "text", text: "We saw Delicate Arch and Corona Arch near Moab." }, baseDeps());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const byName = Object.fromEntries(r.draft.stops.map((s) => [s.name, s]));
    expect(byName["Delicate Arch"]).toMatchObject({ origin: "post", locatedBy: "guide", guideSlug: "utah" });
    expect(byName["Corona Arch"]).toMatchObject({ origin: "post", locatedBy: "lookup" });
    const suggested = r.draft.stops.filter((s) => s.origin === "suggested");
    expect(suggested.length).toBeGreaterThan(0);
    expect(suggested.every((s) => s.locatedBy === "guide" && s.quote === null)).toBe(true);
    expect(r.draft.destinationCountry).toBe("USA");
    expect(r.draft.ordering.kind).toBe("ordered");
    // Suggestions never enter the route.
    if (r.draft.ordering.kind === "ordered") {
      const ids = r.draft.ordering.days.flatMap((d) => d.stopIds);
      expect(ids.every((id) => id.startsWith("p"))).toBe(true);
    }
  });
  it("does not suggest the guide place a post stop was already matched to under another spelling", async () => {
    const g: GuidePlace[] = [
      { name: "Delicate Arch Trail", nearestTown: "Moab", latitude: 38.74, longitude: -109.5, stateSlug: "utah", stateName: "Utah", description: "" },
      { name: "Arches National Park", nearestTown: "Moab", latitude: 38.61, longitude: -109.6, stateSlug: "utah", stateName: "Utah", description: "" },
    ];
    const r = await analyzeSource(
      { mode: "text", text: "We hiked to Delicate Arch at sunrise." },
      baseDeps({
        loadGuide: async () => g,
        extract: async () => ({ destinationCountry: null, tripTitle: null, dropped: [], places: [{ name: "Delicate Arch", area: null, quote: "Delicate Arch" }] }),
      })
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.draft.stops.filter((s) => s.origin === "suggested").map((s) => s.name)).toEqual(["Arches National Park"]);
  });
  it("without a geocoder, stops outside the guides stay off the map and the draft says so", async () => {
    const r = await analyzeSource({ mode: "text", text: "We saw Delicate Arch and Corona Arch near Moab." }, baseDeps({ geocodingOn: false }));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.draft.stops.find((s) => s.name === "Corona Arch")!.lat).toBeNull();
      expect(r.draft.notes.join(" ")).toMatch(/No place lookup/);
    }
  });
  it("reports a post with no named places instead of inventing some", async () => {
    const r = await analyzeSource(
      { mode: "text", text: "Such an amazing weekend, the views were unreal!!" },
      baseDeps({ extract: async () => ({ destinationCountry: null, tripTitle: null, places: [], dropped: [] }) })
    );
    expect(r).toMatchObject({ ok: false });
  });
  it("turns a model failure into a plain retry message", async () => {
    const r = await analyzeSource({ mode: "text", text: "Some long enough caption text here." }, baseDeps({ extract: async () => { throw new Error("boom"); } }));
    expect(r).toMatchObject({ ok: false });
  });
  it("rejects too-short pasted text and empty screenshot sets", async () => {
    expect((await analyzeSource({ mode: "text", text: "hi" }, baseDeps())).ok).toBe(false);
    expect((await analyzeSource({ mode: "screenshots", images: [] }, baseDeps())).ok).toBe(false);
  });
});
