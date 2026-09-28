// Trip expenses and settling up between co-travelers.
//
// All arithmetic happens in integer minor units (cents, yen). Splitting a
// float three ways and adding it back up is how you end up permanently a
// penny out, and "who owes whom" is exactly the number people check twice.
// The remainder from an uneven split is handed to the first payers in a
// stable order rather than dropped, so every split sums exactly to the total.

export type ExpenseRecord = {
  id: string;
  label: string;
  category: string;
  amountMinor: number;
  currency: string;
  amountMinorUsd: number | null;
  spentOn: Date;
  paidById: string;
  splitBetween: string; // comma-separated user ids
};

export type Person = { id: string; name: string };

export type Settlement = {
  fromUserId: string;
  toUserId: string;
  amountMinorUsd: number;
};

export type ExpenseSummary = {
  /** Total in USD minor units across every expense we could convert. */
  totalMinorUsd: number;
  /** Expenses we could not convert to USD — surfaced, not silently dropped. */
  unconvertedCount: number;
  byCategory: Record<string, number>;
  /** Net position per person: positive = owed money, negative = owes money. */
  netByUser: Record<string, number>;
  perPersonPaid: Record<string, number>;
  perPersonOwed: Record<string, number>;
  settlements: Settlement[];
};

export const EXPENSE_CATEGORIES = [
  "lodging",
  "food",
  "transport",
  "activities",
  "other",
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const EXPENSE_CATEGORY_LABELS: Record<string, string> = {
  lodging: "Lodging",
  food: "Food & drink",
  transport: "Transport",
  activities: "Activities",
  other: "Other",
};

export function parseSplit(splitBetween: string): string[] {
  return splitBetween
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Divide `total` between `n` people so the parts sum to exactly `total`.
 * The first `total % n` people carry one extra minor unit.
 */
export function splitEvenly(total: number, n: number): number[] {
  if (n <= 0) return [];
  const base = Math.floor(total / n);
  const remainder = total - base * n;
  return Array.from({ length: n }, (_, i) => base + (i < remainder ? 1 : 0));
}

export function summarizeExpenses(
  expenses: ExpenseRecord[],
  participants: Person[]
): ExpenseSummary {
  const netByUser: Record<string, number> = {};
  const perPersonPaid: Record<string, number> = {};
  const perPersonOwed: Record<string, number> = {};
  const byCategory: Record<string, number> = {};
  for (const p of participants) {
    netByUser[p.id] = 0;
    perPersonPaid[p.id] = 0;
    perPersonOwed[p.id] = 0;
  }

  let totalMinorUsd = 0;
  let unconvertedCount = 0;

  for (const e of expenses) {
    const usd = e.amountMinorUsd;
    if (usd === null) {
      // No rate was available when it was logged (Frankfurter doesn't carry
      // every currency — see src/lib/currency.ts). It still belongs in the
      // list; it just can't join the totals or the settlement.
      unconvertedCount += 1;
      continue;
    }

    totalMinorUsd += usd;
    byCategory[e.category] = (byCategory[e.category] ?? 0) + usd;

    const split = parseSplit(e.splitBetween).filter((id) => id in netByUser);
    // An expense whose split references nobody we know about (a collaborator
    // since removed) falls back to the payer alone, rather than vanishing.
    const shares = split.length > 0 ? split : [e.paidById];
    const amounts = splitEvenly(usd, shares.length);

    if (e.paidById in perPersonPaid) perPersonPaid[e.paidById] += usd;
    if (e.paidById in netByUser) netByUser[e.paidById] += usd;

    shares.forEach((userId, i) => {
      if (!(userId in netByUser)) return;
      netByUser[userId] -= amounts[i];
      perPersonOwed[userId] += amounts[i];
    });
  }

  return {
    totalMinorUsd,
    unconvertedCount,
    byCategory,
    netByUser,
    perPersonPaid,
    perPersonOwed,
    settlements: computeSettlements(netByUser),
  };
}

/**
 * Greedy largest-creditor / largest-debtor matching. Not provably the minimum
 * number of transfers in every case, but it never produces more than n-1 and
 * it's stable and explainable, which matters more here than optimality —
 * people want to see "you pay Ana $40", not a clever graph.
 */
export function computeSettlements(netByUser: Record<string, number>): Settlement[] {
  const creditors = Object.entries(netByUser)
    .filter(([, v]) => v > 0)
    .map(([id, v]) => ({ id, amount: v }))
    .sort((a, b) => b.amount - a.amount || a.id.localeCompare(b.id));
  const debtors = Object.entries(netByUser)
    .filter(([, v]) => v < 0)
    .map(([id, v]) => ({ id, amount: -v }))
    .sort((a, b) => b.amount - a.amount || a.id.localeCompare(b.id));

  const settlements: Settlement[] = [];
  let ci = 0;
  let di = 0;
  while (ci < creditors.length && di < debtors.length) {
    const take = Math.min(creditors[ci].amount, debtors[di].amount);
    if (take > 0) {
      settlements.push({
        fromUserId: debtors[di].id,
        toUserId: creditors[ci].id,
        amountMinorUsd: take,
      });
    }
    creditors[ci].amount -= take;
    debtors[di].amount -= take;
    if (creditors[ci].amount === 0) ci += 1;
    if (debtors[di].amount === 0) di += 1;
  }
  return settlements;
}
