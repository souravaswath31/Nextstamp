import { describe, it, expect } from "vitest";
import { estimateTripCost, getBudgetBreakdown, formatUsd } from "./costs";

describe("estimateTripCost", () => {
  it("scales linearly with day count for each tier", () => {
    expect(estimateTripCost(1, "budget")).toBe(120);
    expect(estimateTripCost(5, "budget")).toBe(600);
    expect(estimateTripCost(1, "mid")).toBe(260);
    expect(estimateTripCost(1, "splurge")).toBe(550);
  });

  it("falls back to the mid rate for an unrecognized tier", () => {
    // @ts-expect-error deliberately passing an invalid tier to test the fallback
    expect(estimateTripCost(1, "not-a-real-tier")).toBe(260);
  });

  it("handles zero days", () => {
    expect(estimateTripCost(0, "mid")).toBe(0);
  });
});

describe("getBudgetBreakdown", () => {
  it("splits the total across the four categories in the documented ratios", () => {
    const breakdown = getBudgetBreakdown(1000);
    expect(breakdown).toEqual({
      lodging: 400,
      food: 300,
      transport: 150,
      activities: 150,
    });
  });

  it("the four categories sum back to (approximately) the total", () => {
    const total = 1820;
    const b = getBudgetBreakdown(total);
    const sum = b.lodging + b.food + b.transport + b.activities;
    // Rounding each category independently can drift by a dollar or two —
    // this is a planning estimate, not an invoice, so an exact match isn't
    // the bar. It should never drift by more than a few dollars, though.
    expect(Math.abs(sum - total)).toBeLessThanOrEqual(4);
  });
});

describe("formatUsd", () => {
  it("formats a whole-dollar amount with no decimal places", () => {
    expect(formatUsd(1234)).toBe("$1,234");
  });

  it("formats zero", () => {
    expect(formatUsd(0)).toBe("$0");
  });
});
