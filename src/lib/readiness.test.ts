import { describe, it, expect } from "vitest";
import { addMonths, passportValidityVerdict } from "./readiness";

const utc = (iso: string) => new Date(`${iso}T12:00:00.000Z`);

describe("addMonths", () => {
  it("keeps the same day of month", () => {
    expect(addMonths(utc("2027-03-14"), 6).toISOString().slice(0, 10)).toBe("2027-09-14");
  });

  it("crosses a year boundary", () => {
    expect(addMonths(utc("2027-10-05"), 6).toISOString().slice(0, 10)).toBe("2028-04-05");
  });

  it("clamps to the end of a shorter target month instead of overflowing", () => {
    // Aug 31 + 6 months is Feb 31, which doesn't exist. A naive Date would roll
    // forward to Mar 2/3 and report a passport as valid long enough when it
    // isn't, so this pulls back to the last day of February instead.
    expect(addMonths(utc("2027-08-31"), 6).toISOString().slice(0, 10)).toBe("2028-02-29");
    expect(addMonths(utc("2026-08-31"), 6).toISOString().slice(0, 10)).toBe("2027-02-28");
  });

  it("clamps a 31st into a 30-day month", () => {
    expect(addMonths(utc("2027-03-31"), 1).toISOString().slice(0, 10)).toBe("2027-04-30");
  });

  it("handles a zero-month rule as a no-op", () => {
    expect(addMonths(utc("2027-03-14"), 0).toISOString().slice(0, 10)).toBe("2027-03-14");
  });
});

describe("passportValidityVerdict", () => {
  const entry = utc("2027-03-14");
  const exit = utc("2027-03-22");

  it("blocks a passport that expires inside the six-month window", () => {
    // Needs validity to 2027-09-14; expires seven weeks earlier.
    const verdict = passportValidityVerdict(utc("2027-07-26"), entry, exit, 6, "entry");
    expect(verdict.state).toBe("blocked");
    expect(verdict.marginDays).toBeLessThan(0);
    expect(verdict.requiredUntil.toISOString().slice(0, 10)).toBe("2027-09-14");
  });

  it("passes a passport with comfortable margin", () => {
    const verdict = passportValidityVerdict(utc("2029-01-01"), entry, exit, 6, "entry");
    expect(verdict.state).toBe("ok");
    expect(verdict.marginDays).toBeGreaterThan(30);
  });

  it("warns rather than passing when the margin is thin", () => {
    // Clears the rule by 10 days — technically fine, but not something to
    // book a non-refundable trip against.
    const verdict = passportValidityVerdict(utc("2027-09-24"), entry, exit, 6, "entry");
    expect(verdict.state).toBe("warn");
    expect(verdict.marginDays).toBe(10);
  });

  it("treats the exact boundary as a pass, not a failure", () => {
    const verdict = passportValidityVerdict(utc("2027-09-14"), entry, exit, 6, "entry");
    expect(verdict.marginDays).toBe(0);
    expect(verdict.state).toBe("warn");
  });

  it("measures from departure when the rule is stated beyond exit", () => {
    const fromEntry = passportValidityVerdict(utc("2027-09-18"), entry, exit, 6, "entry");
    const fromExit = passportValidityVerdict(utc("2027-09-18"), entry, exit, 6, "exit");
    // Same passport, same trip: an exit-based rule needs eight more days of
    // validity than an entry-based one, which is exactly the trap.
    expect(fromExit.requiredUntil.getTime()).toBeGreaterThan(fromEntry.requiredUntil.getTime());
    expect(fromEntry.state).toBe("warn");
    expect(fromExit.state).toBe("blocked");
  });

  it("only needs to cover the trip when the rule is duration-of-stay", () => {
    const verdict = passportValidityVerdict(utc("2027-04-01"), entry, exit, 0, "duration-of-stay");
    expect(verdict.requiredUntil.toISOString().slice(0, 10)).toBe("2027-03-22");
    expect(verdict.marginDays).toBe(10);
    // Legally clear, but still surfaced: a passport expiring ten days after you
    // land home leaves nothing for a delayed flight, and plenty of airlines
    // apply a six-month rule at check-in regardless of what the destination
    // requires. "warn" here is the intended behaviour, not a false positive.
    expect(verdict.state).toBe("warn");
  });

  it("passes duration-of-stay outright when the passport has real room", () => {
    const verdict = passportValidityVerdict(utc("2028-06-01"), entry, exit, 0, "duration-of-stay");
    expect(verdict.state).toBe("ok");
  });

  it("blocks a passport that expires mid-trip even with no stated rule", () => {
    const verdict = passportValidityVerdict(utc("2027-03-18"), entry, exit, 0, "none");
    expect(verdict.state).toBe("blocked");
  });

  it("falls back to the entry date when a trip has no end date", () => {
    const verdict = passportValidityVerdict(utc("2027-03-20"), entry, null, 0, "duration-of-stay");
    expect(verdict.requiredUntil.toISOString().slice(0, 10)).toBe("2027-03-14");
    // Six days of margin — not blocked, but thin enough to say something about.
    expect(verdict.marginDays).toBe(6);
    expect(verdict.state).toBe("warn");
  });

  it("ignores time of day — a passport expiring on the required date still counts", () => {
    // Stored dates land at noon UTC; an expiry recorded at 00:00 and a required
    // date at 23:00 on the same calendar day must not read as a shortfall.
    const expiry = new Date("2027-09-14T00:00:00.000Z");
    const lateEntry = new Date("2027-03-14T23:00:00.000Z");
    const verdict = passportValidityVerdict(expiry, lateEntry, null, 6, "entry");
    expect(verdict.marginDays).toBe(0);
    expect(verdict.state).not.toBe("blocked");
  });
});
