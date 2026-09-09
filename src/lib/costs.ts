// Rough, editable-by-design cost model. Phase 1 has no real pricing feed —
// this exists so the customizer's "adjust pacing / swap lodging tier"
// actions have something to recalculate against. Swap for a real estimator
// later without touching the UI: everything reads through estimateTripCost.

export type CostTier = "budget" | "mid" | "splurge";

const PER_DAY_USD: Record<CostTier, number> = {
  budget: 120,
  mid: 260,
  splurge: 550,
};

export function estimateTripCost(dayCount: number, tier: CostTier): number {
  const perDay = PER_DAY_USD[tier] ?? PER_DAY_USD.mid;
  return Math.round(dayCount * perDay);
}

export function formatUsd(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

// Split the total estimate into categories so "here's a number" becomes
// "here's where it goes" — grounded in real vacation-spend data (Motley
// Fool / Budgetyourtrip.com, 2025), excluding international airfare since
// that's a separate line item travelers already shop for elsewhere:
// lodging ~40%, food ~30%, local transport ~15%, activities ~15%.
export type BudgetBreakdown = {
  lodging: number;
  food: number;
  transport: number;
  activities: number;
};

const BUDGET_SPLIT = {
  lodging: 0.4,
  food: 0.3,
  transport: 0.15,
  activities: 0.15,
};

export function getBudgetBreakdown(totalCost: number): BudgetBreakdown {
  return {
    lodging: Math.round(totalCost * BUDGET_SPLIT.lodging),
    food: Math.round(totalCost * BUDGET_SPLIT.food),
    transport: Math.round(totalCost * BUDGET_SPLIT.transport),
    activities: Math.round(totalCost * BUDGET_SPLIT.activities),
  };
}
