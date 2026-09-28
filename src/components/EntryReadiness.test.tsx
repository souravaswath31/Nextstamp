import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import EntryReadiness from "./EntryReadiness";
import type { ReadinessReport, ReadinessCheck } from "@/lib/readiness";

// EntryReadiness is a server component with no data fetching of its own — it
// takes a finished report and renders it. That makes it renderable straight to
// a string here, which is the only automated coverage it can get: it never
// appears on a page a logged-out browser can reach, so a manual pass would
// mean holding a real session.

function report(checks: ReadinessCheck[], overrides: Partial<ReadinessReport> = {}): ReadinessReport {
  return {
    destinationCountry: "Japan",
    startDate: new Date("2027-03-14T12:00:00Z"),
    endDate: new Date("2027-03-22T12:00:00Z"),
    tripNights: 8,
    daysUntilDeparture: 120,
    visaStatus: null,
    countryFact: null,
    checks,
    overall: checks.reduce<ReadinessReport["overall"]>((acc, c) => {
      const rank = { ok: 0, unknown: 1, warn: 2, blocked: 3 } as const;
      return rank[c.state] > rank[acc] ? c.state : acc;
    }, "ok"),
    ...overrides,
  };
}

const okCheck: ReadinessCheck = {
  id: "passport-expiry",
  label: "Passport validity",
  state: "ok",
  detail: "Your passport is valid through Jan 1, 2030.",
};

const blockedCheck: ReadinessCheck = {
  id: "visa",
  label: "Visa required in advance",
  state: "blocked",
  detail: "You need a visa before you travel.",
  action: "Start the application at the official source.",
  sourceUrl: "https://example.gov/visa",
};

const warnCheck: ReadinessCheck = {
  id: "onward-ticket",
  label: "Proof of onward travel",
  state: "warn",
  detail: "Japan requires proof you're leaving.",
};

describe("EntryReadiness", () => {
  it("renders nothing when there are no checks, rather than an empty panel", () => {
    expect(renderToStaticMarkup(<EntryReadiness report={report([])} />)).toBe("");
  });

  it("shows each check's label, detail, action and source", () => {
    const html = renderToStaticMarkup(<EntryReadiness report={report([blockedCheck])} />);
    expect(html).toContain("Visa required in advance");
    expect(html).toContain("You need a visa before you travel.");
    expect(html).toContain("Start the application at the official source.");
    expect(html).toContain("https://example.gov/visa");
  });

  it("counts blockers in the summary badge", () => {
    const html = renderToStaticMarkup(
      <EntryReadiness report={report([blockedCheck, { ...blockedCheck, id: "b2" }, okCheck])} />
    );
    expect(html).toContain("2 blockers");
    expect(html).toContain("Something here will stop you");
  });

  it("uses the singular for one blocker", () => {
    const html = renderToStaticMarkup(<EntryReadiness report={report([blockedCheck])} />);
    expect(html).toContain("1 blocker");
    expect(html).not.toContain("1 blockers");
  });

  it("sorts blockers above warnings above clear items", () => {
    const html = renderToStaticMarkup(
      <EntryReadiness report={report([okCheck, warnCheck, blockedCheck])} />
    );
    const posBlocked = html.indexOf("Visa required in advance");
    const posWarn = html.indexOf("Proof of onward travel");
    const posOk = html.indexOf("Passport validity");
    expect(posBlocked).toBeLessThan(posWarn);
    expect(posWarn).toBeLessThan(posOk);
  });

  it("says everything is clear when nothing needs doing", () => {
    const html = renderToStaticMarkup(<EntryReadiness report={report([okCheck])} />);
    expect(html).toContain("Nothing standing between you and the gate");
    expect(html).not.toContain("blocker");
  });

  it("shows a departure countdown, with today phrased as today", () => {
    expect(
      renderToStaticMarkup(<EntryReadiness report={report([okCheck], { daysUntilDeparture: 12 })} />)
    ).toContain("12 days until departure");
    expect(
      renderToStaticMarkup(<EntryReadiness report={report([okCheck], { daysUntilDeparture: 1 })} />)
    ).toContain("1 day until departure");
    expect(
      renderToStaticMarkup(<EntryReadiness report={report([okCheck], { daysUntilDeparture: 0 })} />)
    ).toContain("You leave today.");
  });

  it("omits the countdown for a date already past", () => {
    const html = renderToStaticMarkup(
      <EntryReadiness report={report([okCheck], { daysUntilDeparture: -5 })} />
    );
    expect(html).not.toContain("until departure");
  });

  it("renders without a destination rather than printing 'null'", () => {
    const html = renderToStaticMarkup(
      <EntryReadiness
        report={report([{ ...okCheck, state: "unknown" }], {
          destinationCountry: null,
          daysUntilDeparture: null,
        })}
      />
    );
    expect(html).not.toContain("null");
    expect(html).toContain("We need a bit more from you");
  });

  it("drops the footnote in compact mode", () => {
    const full = renderToStaticMarkup(<EntryReadiness report={report([okCheck])} />);
    const compact = renderToStaticMarkup(<EntryReadiness report={report([okCheck])} compact />);
    expect(full).toContain("Update your documents");
    expect(compact).not.toContain("Update your documents");
  });
});
