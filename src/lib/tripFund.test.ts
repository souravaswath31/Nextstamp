import { describe, it, expect } from "vitest";
import { fundProgress } from "./tripFund";

describe("fundProgress", () => {
  it("sums deposits and withdrawals in minor units", () => {
    const p = fundProgress(100_000, [{ amountMinor: 25_000 }, { amountMinor: 30_050 }, { amountMinor: -5_050 }]);
    expect(p.savedMinor).toBe(50_000);
    expect(p.remainingMinor).toBe(50_000);
    expect(p.percent).toBe(50);
    expect(p.reached).toBe(false);
  });
  it("clamps the bar but not the total", () => {
    const over = fundProgress(10_000, [{ amountMinor: 12_500 }]);
    expect(over.percent).toBe(100);
    expect(over.savedMinor).toBe(12_500);
    expect(over.remainingMinor).toBe(0);
    expect(over.reached).toBe(true);
    const under = fundProgress(10_000, [{ amountMinor: -500 }]);
    expect(under.percent).toBe(0);
    expect(under.savedMinor).toBe(-500);
  });
  it("does not divide by a zero target", () => {
    expect(fundProgress(0, [{ amountMinor: 100 }]).percent).toBe(0);
  });
});
