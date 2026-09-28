// Live exchange rates, so a budget estimate can be read in the currency the
// traveller will actually be handing over.
//
// Source: Frankfurter (https://frankfurter.dev) — no key, no signup, rates
// published by the European Central Bank. Two honest limitations we surface
// rather than paper over:
//   1. The ECB publishes ~30 currencies. Several NextStamp destinations
//      (Vietnam, Egypt, Morocco, Sri Lanka, Maldives, Georgia, Armenia,
//      Serbia, Peru, Colombia, Costa Rica, UAE) are not among them. When a
//      currency isn't covered we say so instead of inventing a rate.
//   2. Rates update on weekdays, around 16:00 CET. A weekend figure is
//      Friday's. The returned `asOf` date is shown in the UI for that reason.

export type ConversionResult = {
  supported: boolean;
  base: string;
  target: string;
  rate: number | null;
  asOf: string | null;
};

const FRANKFURTER_BASE = "https://api.frankfurter.dev/v1";
const SIX_HOURS = 21_600;

/**
 * Which currencies the ECB feed actually carries. Fetched rather than
 * hardcoded so the list can't silently drift out of date, cached for a day.
 */
export async function getSupportedCurrencies(): Promise<Record<string, string>> {
  try {
    const res = await fetch(`${FRANKFURTER_BASE}/currencies`, {
      next: { revalidate: 86_400 },
    });
    if (!res.ok) return {};
    const data = (await res.json()) as Record<string, string>;
    return data && typeof data === "object" ? data : {};
  } catch {
    return {};
  }
}

export async function getRate(base: string, target: string): Promise<ConversionResult> {
  const b = base.toUpperCase();
  const t = target.toUpperCase();

  if (!b || !t) return { supported: false, base: b, target: t, rate: null, asOf: null };
  if (b === t) {
    return { supported: true, base: b, target: t, rate: 1, asOf: null };
  }

  try {
    const res = await fetch(`${FRANKFURTER_BASE}/latest?base=${b}&symbols=${t}`, {
      next: { revalidate: SIX_HOURS },
    });
    if (!res.ok) {
      return { supported: false, base: b, target: t, rate: null, asOf: null };
    }
    const data = (await res.json()) as { date?: string; rates?: Record<string, number> };
    const rate = data.rates?.[t];
    if (typeof rate !== "number") {
      return { supported: false, base: b, target: t, rate: null, asOf: null };
    }
    return { supported: true, base: b, target: t, rate, asOf: data.date ?? null };
  } catch {
    return { supported: false, base: b, target: t, rate: null, asOf: null };
  }
}

/**
 * Format an amount in a currency without assuming the caller knows how many
 * decimal places it takes — Intl does, and yen/won take zero where dollars
 * take two. Falls back to the code as a prefix for anything Intl doesn't
 * recognise, rather than throwing on a page render.
 */
export function formatCurrency(amount: number, currencyCode: string, maxFractionDigits?: number): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currencyCode,
      maximumFractionDigits: maxFractionDigits ?? 0,
    }).format(amount);
  } catch {
    return `${currencyCode} ${Math.round(amount).toLocaleString("en-US")}`;
  }
}

/**
 * How many minor units (cents, pence, satang) one unit of a currency has.
 * TripExpense stores integers in minor units, so this is what converts
 * between the stored value and something a person types.
 */
export function minorUnitsFor(currencyCode: string): number {
  try {
    const fmt = new Intl.NumberFormat("en-US", { style: "currency", currency: currencyCode });
    const digits = fmt.resolvedOptions().maximumFractionDigits ?? 2;
    return 10 ** digits;
  } catch {
    return 100;
  }
}

export function toMinor(amount: number, currencyCode: string): number {
  return Math.round(amount * minorUnitsFor(currencyCode));
}

export function fromMinor(amountMinor: number, currencyCode: string): number {
  return amountMinor / minorUnitsFor(currencyCode);
}
