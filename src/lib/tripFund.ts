export type FundEntry = { amountMinor: number };

export type FundProgress = {
  savedMinor: number;
  targetMinor: number;
  remainingMinor: number;
  /** 0–100, clamped, for a progress bar. */
  percent: number;
  reached: boolean;
};

/**
 * Where a savings target stands. Pure integer arithmetic in the currency's
 * minor unit — the same rule as expenses, for the same reason: floats drift.
 * Withdrawals are negative entries, and the total may legitimately go below
 * zero if someone logs more out than in, so it is not clamped; only the
 * progress-bar percent is.
 */
export function fundProgress(targetMinor: number, entries: FundEntry[]): FundProgress {
  const savedMinor = entries.reduce((sum, e) => sum + e.amountMinor, 0);
  const percent =
    targetMinor <= 0 ? 0 : Math.max(0, Math.min(100, Math.round((savedMinor / targetMinor) * 100)));
  return {
    savedMinor,
    targetMinor,
    remainingMinor: Math.max(0, targetMinor - savedMinor),
    percent,
    reached: targetMinor > 0 && savedMinor >= targetMinor,
  };
}
