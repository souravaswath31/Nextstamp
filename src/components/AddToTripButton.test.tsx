import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import AddToTripButton from "./AddToTripButton";
import SavedPlaces from "./SavedPlaces";

vi.mock("@/lib/actions", () => ({
  savePlaceToTrip: vi.fn(),
  addSavedPlaceToDay: vi.fn(),
  removeSavedPlace: vi.fn(),
}));

const place = { name: "Maroon Bells", note: "Go at sunrise", sourceKind: "state_place" };

describe("AddToTripButton", () => {
  it("offers a way in rather than a dead button when signed out", () => {
    // This sits on a public guide page, so "signed out" is a normal state,
    // not an edge case.
    const html = renderToStaticMarkup(
      <AddToTripButton place={place} trips={[]} isSignedIn={false} />
    );
    expect(html).toContain("/login");
    expect(html).toContain("Sign in to add this to a trip");
    expect(html).not.toContain("<button");
  });

  it("points a signed-in user with no trips at starting one", () => {
    const html = renderToStaticMarkup(
      <AddToTripButton place={place} trips={[]} isSignedIn />
    );
    expect(html).toContain("Start a trip to save this to");
  });

  it("saves in one click when there's only one trip", () => {
    // The common case. Making someone open a picker to choose from a list of
    // one is exactly the friction this feature exists to remove.
    const html = renderToStaticMarkup(
      <AddToTripButton place={place} trips={[{ id: "t1", title: "Colorado" }]} isSignedIn />
    );
    expect(html).toContain("Add to Colorado");
    expect(html).not.toContain("Add to a trip");
  });

  it("offers a picker when there are several", () => {
    const html = renderToStaticMarkup(
      <AddToTripButton
        place={place}
        trips={[
          { id: "t1", title: "Colorado" },
          { id: "t2", title: "Utah" },
        ]}
        isSignedIn
      />
    );
    expect(html).toContain("Add to a trip");
    expect(html).toContain('aria-expanded="false"');
  });
});

const saved = (over: Partial<Parameters<typeof SavedPlaces>[0]["places"][0]> = {}) => ({
  id: "p1",
  name: "Maroon Bells",
  note: "Go at sunrise",
  sourceKind: "state_place",
  sourceSlug: "colorado",
  usedOnDay: null,
  hasCoords: true,
  ...over,
});

describe("SavedPlaces", () => {
  it("renders nothing at all when there's nothing saved", () => {
    // No empty state here on purpose: the section only makes sense once the
    // add-to-trip flow has actually been used, and an empty panel on every
    // trip would be noise.
    expect(
      renderToStaticMarkup(<SavedPlaces tripId="t1" places={[]} dayNumbers={[1, 2]} />)
    ).toBe("");
  });

  it("links back to the guide the place came from", () => {
    const html = renderToStaticMarkup(
      <SavedPlaces tripId="t1" places={[saved()]} dayNumbers={[1, 2]} />
    );
    expect(html).toContain("/state/colorado");
    expect(html).toContain("Maroon Bells");
    expect(html).toContain("Go at sunrise");
  });

  it("keeps a placed item visible rather than making it vanish", () => {
    const html = renderToStaticMarkup(
      <SavedPlaces tripId="t1" places={[saved({ usedOnDay: 3 })]} dayNumbers={[1, 2, 3]} />
    );
    expect(html).toContain("Maroon Bells");
    expect(html).toContain("on day 3");
    // Already placed, so it shouldn't still be offering to place it.
    expect(html).not.toContain("Add to a day");
  });

  it("says what to do first when the trip has no days yet", () => {
    const html = renderToStaticMarkup(
      <SavedPlaces tripId="t1" places={[saved()]} dayNumbers={[]} />
    );
    expect(html).toContain("Add a day first");
  });

  it("lists every day as a slot target", () => {
    const html = renderToStaticMarkup(
      <SavedPlaces tripId="t1" places={[saved()]} dayNumbers={[1, 2, 3]} />
    );
    expect(html).toContain("Add to a day");
  });
});
