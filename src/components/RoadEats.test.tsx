import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import RoadEats from "./RoadEats";
import type { EatGroup } from "@/lib/roadEats";

vi.mock("@/lib/actions", () => ({ savePlaceToTrip: vi.fn() }));

function group(over: Partial<EatGroup["stop"]> = {}, days = [1, 2, 3], town = "Springdale"): EatGroup {
  return {
    town,
    dayNumbers: days,
    stop: {
      id: "s1",
      regionKey: "utah",
      town,
      note: null,
      noteSourceUrl: null,
      lastVerifiedDate: new Date("2026-10-03T12:00:00Z"),
      eats: [
        {
          id: "e1",
          stopId: "s1",
          name: "Cafe Soleil",
          kind: "cafe",
          meal: "breakfast",
          whatToOrder: "Breakfast burrito",
          why: "Opens at 7 for early trailhead starts.",
          priceTier: "$",
          hoursNote: "Closed Sundays in winter",
          openEvidence: "Own website lists 2026 hours (viewed 2026-10-03)",
          sourceUrl: "https://example.com/soleil",
          sourceName: "Venue's own website",
          sortOrder: 0,
        },
      ],
      ...over,
    },
  };
}

describe("RoadEats", () => {
  it("renders nothing when there are no groups, rather than an empty heading", () => {
    expect(renderToStaticMarkup(<RoadEats groups={[]} />)).toBe("");
  });

  it("heads each group with its days and town", () => {
    const html = renderToStaticMarkup(<RoadEats groups={[group()]} />);
    expect(html).toContain("Days 1–3");
    expect(html).toContain("Springdale");
  });

  it("shows what to order, why, and the meal", () => {
    const html = renderToStaticMarkup(<RoadEats groups={[group()]} />);
    expect(html).toContain("Cafe Soleil");
    expect(html).toContain("Breakfast burrito");
    expect(html).toContain("Opens at 7 for early trailhead starts.");
    expect(html).toContain("Breakfast");
    expect(html).toContain("Café");
  });

  it("surfaces a stated closing day or season prominently", () => {
    // A traveller sent to a shuttered place has been let down by us — the caveat
    // can't be buried.
    const html = renderToStaticMarkup(<RoadEats groups={[group()]} />);
    expect(html).toContain("Closed Sundays in winter");
  });

  it("shows the evidence it's operating and links the source", () => {
    const html = renderToStaticMarkup(<RoadEats groups={[group()]} />);
    expect(html).toContain("Own website lists 2026 hours (viewed 2026-10-03)");
    expect(html).toContain('href="https://example.com/soleil"');
    expect(html).toContain("Venue&#x27;s own website");
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it("says out loud that restaurants change, not just in a footnote nobody reads", () => {
    const html = renderToStaticMarkup(<RoadEats groups={[group()]} />);
    expect(html).toContain("Restaurants change hours and close");
  });

  it("shows the thin-options note, with its source, where options are limited", () => {
    const html = renderToStaticMarkup(
      <RoadEats
        groups={[
          group({
            note: "No dining inside the park; pack lunch for trail days.",
            noteSourceUrl: "https://www.nps.gov/zion/dining",
          }),
        ]}
      />
    );
    expect(html).toContain("No dining inside the park; pack lunch for trail days.");
    expect(html).toContain("https://www.nps.gov/zion/dining");
  });

  it("omits the price when no source stated one, instead of showing a blank", () => {
    const g = group();
    g.stop.eats[0].priceTier = null;
    const html = renderToStaticMarkup(<RoadEats groups={[g]} />);
    expect(html).not.toContain("tabular-nums text-ink/45");
  });

  it("omits the closing-days callout when nothing was stated", () => {
    // null hoursNote means "nothing stated", NOT "open year-round" — so it must
    // render as absence, never as a reassurance.
    const g = group();
    g.stop.eats[0].hoursNote = null;
    const html = renderToStaticMarkup(<RoadEats groups={[g]} />);
    expect(html).not.toContain("Closed");
    expect(html).not.toContain("year-round");
  });

  it("warns when the check is old", () => {
    const html = renderToStaticMarkup(
      <RoadEats groups={[group({ lastVerifiedDate: new Date("2024-01-10T12:00:00Z") })]} />
    );
    expect(html).toContain("confirm it&#x27;s still open");
  });

  it("offers add-to-trip on each eat, handling the signed-out case", () => {
    const html = renderToStaticMarkup(<RoadEats groups={[group()]} isSignedIn={false} />);
    expect(html).toContain("Sign in to add this to a trip");
  });

  it("saves in one click to a single trip", () => {
    const html = renderToStaticMarkup(
      <RoadEats groups={[group()]} isSignedIn trips={[{ id: "t1", title: "Utah loop" }]} />
    );
    expect(html).toContain("Add to Utah loop");
  });

  it("uses a custom heading for the trip page", () => {
    const html = renderToStaticMarkup(
      <RoadEats groups={[group()]} heading="Eat along your route" />
    );
    expect(html).toContain("Eat along your route");
  });
});
