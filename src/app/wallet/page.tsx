import type { Metadata } from "next";
import Link from "next/link";
import { PiggyBank, Trash2, ShieldAlert } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getOptionalUser } from "@/lib/currentUser";
import { addFundEntry, createFund, deleteFund, deleteFundEntry } from "@/lib/fundActions";
import { fundProgress } from "@/lib/tripFund";
import { formatCurrency, fromMinor } from "@/lib/currency";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Trip fund — NextStamp",
  description: "A notebook for what you've set aside for a trip. NextStamp never holds your money.",
};

const CURRENCIES = ["USD", "EUR", "GBP", "INR", "CAD", "AUD", "JPY", "SGD", "BRL", "CHF", "MXN"];

const input =
  "w-full rounded-card border border-line bg-paper px-3.5 py-2.5 font-body text-sm text-ink placeholder:text-ink/35 focus:border-coral focus:outline-none focus-visible:ring-2 focus-visible:ring-coral/30";

export default async function WalletPage() {
  const user = await getOptionalUser();

  const funds = user
    ? await prisma.tripFund.findMany({
        where: { userId: user.id },
        include: { entries: { orderBy: { enteredOn: "desc" } } },
        orderBy: { createdAt: "desc" },
      })
    : [];
  const trips = user
    ? await prisma.userTrip.findMany({
        where: { userId: user.id, status: { not: "completed" } },
        select: { id: true, title: true },
        orderBy: { updatedAt: "desc" },
      })
    : [];
  const tripTitle = new Map(trips.map((t) => [t.id, t.title]));

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <p className="font-stamp text-xs uppercase tracking-widest text-ink/45">Trip fund</p>
        <h1 className="mt-2 font-display text-4xl tracking-tightest text-ink">What you&apos;ve set aside</h1>
        <p className="mt-3 max-w-xl font-body text-ink/60">
          Set a target for a trip, and write down what you put toward it.
        </p>
      </div>

      <div className="flex gap-3 rounded-panel bg-stamp/10 p-4 font-body text-sm text-ink/75">
        <ShieldAlert size={18} className="mt-0.5 shrink-0 text-stamp" aria-hidden="true" />
        <p>
          <strong className="text-ink">This is a notebook, not an account.</strong> NextStamp never
          holds your money and never connects to a bank. The amounts are only what you type in, so
          they won&apos;t change if your real balance does.
        </p>
      </div>

      {!user ? (
        <div className="rounded-panel bg-paper p-6 text-center shadow-paper">
          <PiggyBank size={28} className="mx-auto text-ink/30" aria-hidden="true" />
          <p className="mt-3 font-body text-sm text-ink/60">Sign in to keep a trip fund.</p>
          <Link href="/login" className="btn-pill btn-pill-primary mt-4">Sign in</Link>
        </div>
      ) : (
        <>
          <form action={createFund} className="space-y-4 rounded-panel bg-paper p-5 shadow-paper sm:p-6">
            <h2 className="font-display text-xl text-ink">New trip fund</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label htmlFor="fund-name" className="mb-1 block font-body text-xs font-medium text-ink/65">Name</label>
                <input id="fund-name" name="name" required maxLength={80} placeholder="Japan, spring" className={input} />
              </div>
              <div>
                <label htmlFor="fund-target" className="mb-1 block font-body text-xs font-medium text-ink/65">Target</label>
                <input id="fund-target" name="target" required inputMode="decimal" placeholder="3000" className={input} />
              </div>
              <div>
                <label htmlFor="fund-currency" className="mb-1 block font-body text-xs font-medium text-ink/65">Currency</label>
                <select id="fund-currency" name="currency" defaultValue="USD" className={input}>
                  {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
              {trips.length > 0 && (
                <div className="sm:col-span-2">
                  <label htmlFor="fund-trip" className="mb-1 block font-body text-xs font-medium text-ink/65">Linked trip (optional)</label>
                  <select id="fund-trip" name="tripId" defaultValue="" className={input}>
                    <option value="">None</option>
                    {trips.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
                  </select>
                </div>
              )}
            </div>
            <button type="submit" className="btn-pill btn-pill-primary">Create fund</button>
          </form>

          {funds.length === 0 ? (
            <p className="font-body text-sm text-ink/50">No funds yet. Create one above.</p>
          ) : (
            <ul className="space-y-5">
              {funds.map((f) => {
                const p = fundProgress(f.targetMinor, f.entries);
                const money = (minor: number) => formatCurrency(fromMinor(minor, f.currency), f.currency);
                return (
                  <li key={f.id} className="rounded-panel bg-paper p-5 shadow-paper sm:p-6">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="font-display text-xl text-ink">{f.name}</h3>
                        {f.tripId && tripTitle.get(f.tripId) && (
                          <Link href={`/trip/${f.tripId}`} className="font-body text-xs text-coralDark hover:underline">
                            {tripTitle.get(f.tripId)}
                          </Link>
                        )}
                      </div>
                      <form action={deleteFund.bind(null, f.id)}>
                        <button type="submit" className="font-body text-xs text-ink/45 hover:text-stampRed" aria-label={`Delete ${f.name}`}>
                          <Trash2 size={15} />
                        </button>
                      </form>
                    </div>

                    <p className="mt-4 font-display text-3xl tabular-nums text-ink">
                      {money(p.savedMinor)}
                      <span className="ml-2 font-body text-sm font-normal text-ink/50">of {money(p.targetMinor)}</span>
                    </p>
                    <div
                      className="mt-3 h-2 overflow-hidden rounded-full bg-ink/10"
                      role="progressbar"
                      aria-valuenow={p.percent}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`${f.name} progress`}
                    >
                      <div className={`h-full rounded-full ${p.reached ? "bg-forest" : "bg-coral"}`} style={{ width: `${p.percent}%` }} />
                    </div>
                    <p className="mt-2 font-body text-xs text-ink/50">
                      {p.reached ? "Target reached." : `${money(p.remainingMinor)} to go.`}
                    </p>

                    <form action={addFundEntry.bind(null, f.id)} className="mt-5 grid gap-2 sm:grid-cols-[7rem_6rem_1fr_auto]">
                      <label className="sr-only" htmlFor={`amt-${f.id}`}>Amount</label>
                      <input id={`amt-${f.id}`} name="amount" required inputMode="decimal" placeholder="Amount" className={input} />
                      <label className="sr-only" htmlFor={`dir-${f.id}`}>Direction</label>
                      <select id={`dir-${f.id}`} name="direction" defaultValue="in" className={input}>
                        <option value="in">Put in</option>
                        <option value="out">Took out</option>
                      </select>
                      <label className="sr-only" htmlFor={`note-${f.id}`}>Note</label>
                      <input id={`note-${f.id}`} name="note" maxLength={120} placeholder="Note (optional)" className={input} />
                      <button type="submit" className="btn-pill btn-pill-primary !py-2.5">Add</button>
                    </form>

                    {f.entries.length > 0 && (
                      <ul className="mt-4 divide-y divide-line">
                        {f.entries.map((e) => (
                          <li key={e.id} className="flex items-center justify-between gap-3 py-2 font-body text-sm">
                            <span className="min-w-0 text-ink/65">
                              {e.enteredOn.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}
                              {e.note ? ` · ${e.note}` : ""}
                            </span>
                            <span className="flex items-center gap-3">
                              <span className={`tabular-nums ${e.amountMinor < 0 ? "text-stampRed" : "text-ink"}`}>
                                {e.amountMinor < 0 ? "−" : "+"}
                                {money(Math.abs(e.amountMinor))}
                              </span>
                              <form action={deleteFundEntry.bind(null, e.id)}>
                                <button type="submit" aria-label="Delete entry" className="text-ink/35 hover:text-stampRed">
                                  <Trash2 size={13} />
                                </button>
                              </form>
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
