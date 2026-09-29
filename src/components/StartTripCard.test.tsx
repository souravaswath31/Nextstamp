import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import StartTripCard from "./StartTripCard";

// The dashboard is behind a login, so this component can't be checked in a
// browser without holding a real session. Rendering it directly is the
// available verification — and what's being checked here is mostly copy and
// hierarchy, which is exactly what the redesign was about.

// createBlankTrip is a server action; it only runs on submit, but the module
// pulls in Prisma at import time.
vi.mock("@/lib/actions", () => ({ createBlankTrip: vi.fn() }));

describe("StartTripCard", () => {
  it("offers a real control, not a sentence telling you to go elsewhere", () => {
    const html = renderToStaticMarkup(<StartTripCard isFirstTrip easyAccessCount={0} />);
    expect(html).toContain("<form");
    expect(html).toContain("Start planning");
    expect(html).toContain('placeholder="Two weeks in Japan"');
    // The old dashboard's only route to a trip was a link to /my-trips. The
    // whole point of this component is that you don't have to go there.
    expect(html).not.toContain("/my-trips");
  });

  it("frames the first trip differently from a later one", () => {
    expect(renderToStaticMarkup(<StartTripCard isFirstTrip easyAccessCount={0} />)).toContain(
      "Start your first trip"
    );
    expect(
      renderToStaticMarkup(<StartTripCard isFirstTrip={false} easyAccessCount={0} />)
    ).toContain("Start another trip");
  });

  it("reassures a first-time user that nothing is committed", () => {
    const html = renderToStaticMarkup(<StartTripCard isFirstTrip easyAccessCount={0} />);
    expect(html).toContain("nothing is booked or shared until you say so");
  });

  it("surfaces the passport hook when there is one", () => {
    const html = renderToStaticMarkup(<StartTripCard isFirstTrip easyAccessCount={14} />);
    expect(html).toContain("14 places your passport already opens");
  });

  it("says nothing about the passport when we'd have to say zero", () => {
    // A brand-new user whose visa coverage hasn't resolved shouldn't be told
    // their passport opens nothing — that reads as a verdict, not a gap.
    const html = renderToStaticMarkup(<StartTripCard isFirstTrip easyAccessCount={0} />);
    expect(html).not.toContain("places your passport");
    expect(html).not.toContain("0 places");
  });

  it("keeps browsing available but visibly secondary to the primary action", () => {
    const html = renderToStaticMarkup(<StartTripCard isFirstTrip easyAccessCount={0} />);
    const primary = html.indexOf("Start planning");
    const secondary = html.indexOf("browse trip ideas");
    expect(primary).toBeGreaterThan(-1);
    expect(secondary).toBeGreaterThan(primary);
    // The primary uses the accent button; the fallback is a ghost link.
    expect(html).toContain("btn-pill-accent");
    expect(html).toContain("btn-ghost");
  });

  it("labels the input for screen readers", () => {
    const html = renderToStaticMarkup(<StartTripCard isFirstTrip easyAccessCount={0} />);
    expect(html).toContain('aria-label="Name your trip"');
  });
});
