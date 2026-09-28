import { describe, it, expect } from "vitest";
import {
  computeSettlements,
  parseSplit,
  splitEvenly,
  summarizeExpenses,
  type ExpenseRecord,
} from "./expenses";

// The whole reason this module works in integer minor units is that money
// people owe each other has to add up exactly. These tests are mostly about
// that invariant rather than about the happy path.

describe("splitEvenly", () => {
  it("divides evenly when it divides evenly", () => {
    expect(splitEvenly(900, 3)).toEqual([300, 300, 300]);
  });

  it("hands the remainder to the earliest shares rather than dropping it", () => {
    expect(splitEvenly(1000, 3)).toEqual([334, 333, 333]);
    expect(splitEvenly(1000, 3).reduce((a, b) => a + b, 0)).toBe(1000);
  });

  it("never loses or invents a minor unit, for any total and party size", () => {
    for (let total = 0; total < 200; total++) {
      for (let n = 1; n <= 7; n++) {
        const parts = splitEvenly(total, n);
        expect(parts).toHaveLength(n);
        expect(parts.reduce((a, b) => a + b, 0)).toBe(total);
      }
    }
  });

  it("returns nothing for a nonsensical party size instead of throwing", () => {
    expect(splitEvenly(100, 0)).toEqual([]);
    expect(splitEvenly(100, -2)).toEqual([]);
  });
});

describe("parseSplit", () => {
  it("tolerates whitespace and trailing separators", () => {
    expect(parseSplit("a, b ,c,")).toEqual(["a", "b", "c"]);
    expect(parseSplit("")).toEqual([]);
  });
});

describe("computeSettlements", () => {
  it("returns nothing when everyone is square", () => {
    expect(computeSettlements({ a: 0, b: 0 })).toEqual([]);
  });

  it("moves money from debtors to creditors and nets to zero", () => {
    const net = { a: 2000, b: -1500, c: -500 };
    const settlements = computeSettlements(net);
    const moved = settlements.reduce((sum, s) => sum + s.amountMinorUsd, 0);
    expect(moved).toBe(2000);
    for (const s of settlements) {
      expect(s.amountMinorUsd).toBeGreaterThan(0);
      expect(s.fromUserId).not.toBe(s.toUserId);
    }
  });

  it("never needs more than one fewer transfer than there are people", () => {
    const net = { a: 300, b: 300, c: 300, d: -450, e: -450 };
    expect(computeSettlements(net).length).toBeLessThanOrEqual(4);
  });
});

function expense(partial: Partial<ExpenseRecord> & { id: string }): ExpenseRecord {
  return {
    label: "thing",
    category: "food",
    amountMinor: 0,
    currency: "USD",
    amountMinorUsd: 0,
    spentOn: new Date("2027-03-15T12:00:00Z"),
    paidById: "a",
    splitBetween: "a",
    ...partial,
  };
}

describe("summarizeExpenses", () => {
  const people = [
    { id: "a", name: "Ana" },
    { id: "b", name: "Ben" },
  ];

  it("leaves the payer square when they paid for only themselves", () => {
    const summary = summarizeExpenses(
      [expense({ id: "1", amountMinor: 5000, amountMinorUsd: 5000, paidById: "a", splitBetween: "a" })],
      people
    );
    expect(summary.totalMinorUsd).toBe(5000);
    expect(summary.netByUser).toEqual({ a: 0, b: 0 });
    expect(summary.settlements).toEqual([]);
  });

  it("makes the other person owe half when one pays for both", () => {
    const summary = summarizeExpenses(
      [expense({ id: "1", amountMinor: 5000, amountMinorUsd: 5000, paidById: "a", splitBetween: "a,b" })],
      people
    );
    expect(summary.netByUser.a).toBe(2500);
    expect(summary.netByUser.b).toBe(-2500);
    expect(summary.settlements).toEqual([
      { fromUserId: "b", toUserId: "a", amountMinorUsd: 2500 },
    ]);
  });

  it("counts an unconvertible expense separately instead of dropping it silently", () => {
    const summary = summarizeExpenses(
      [
        expense({ id: "1", amountMinor: 5000, amountMinorUsd: 5000 }),
        // Vietnamese dong isn't in the ECB feed, so addExpense stores null.
        expense({ id: "2", amountMinor: 500_000, currency: "VND", amountMinorUsd: null }),
      ],
      people
    );
    expect(summary.totalMinorUsd).toBe(5000);
    expect(summary.unconvertedCount).toBe(1);
  });

  it("falls back to the payer when a split references someone no longer on the trip", () => {
    const summary = summarizeExpenses(
      [expense({ id: "1", amountMinor: 3000, amountMinorUsd: 3000, paidById: "a", splitBetween: "gone" })],
      people
    );
    // The removed collaborator can't be charged, so the expense doesn't
    // vanish from the total — it just lands entirely on the payer.
    expect(summary.totalMinorUsd).toBe(3000);
    expect(summary.netByUser.a).toBe(0);
    expect(summary.netByUser.b).toBe(0);
  });

  it("ignores a participant who has no expenses rather than reporting a phantom debt", () => {
    const summary = summarizeExpenses([], people);
    expect(summary.netByUser).toEqual({ a: 0, b: 0 });
    expect(summary.settlements).toEqual([]);
    expect(summary.totalMinorUsd).toBe(0);
  });

  it("keeps the three-way remainder consistent between totals and settlements", () => {
    const three = [
      { id: "a", name: "Ana" },
      { id: "b", name: "Ben" },
      { id: "c", name: "Cal" },
    ];
    const summary = summarizeExpenses(
      [expense({ id: "1", amountMinor: 1000, amountMinorUsd: 1000, paidById: "a", splitBetween: "a,b,c" })],
      three
    );
    const net = Object.values(summary.netByUser).reduce((x, y) => x + y, 0);
    expect(net).toBe(0);
    const moved = summary.settlements.reduce((sum, s) => sum + s.amountMinorUsd, 0);
    expect(moved).toBe(summary.netByUser.a);
  });
});
