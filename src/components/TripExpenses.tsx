"use client";

import { useMemo, useState, useTransition } from "react";
import { Receipt, Plus, Trash2, ArrowRight } from "lucide-react";
import { addExpense, removeExpense } from "@/lib/actions";
import { formatUsd } from "@/lib/costs";
import {
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_LABELS,
  parseSplit,
  summarizeExpenses,
  type ExpenseRecord,
  type Person,
} from "@/lib/expenses";
import { formatCurrency, fromMinor } from "@/lib/currency";

type Props = {
  tripId: string;
  /** Dates serialized as ISO strings — a Date can't cross the server/client
   *  boundary as a prop in every Next 14 path, and the display is date-only. */
  expenses: (Omit<ExpenseRecord, "spentOn"> & { spentOn: string; paidByName: string })[];
  participants: Person[];
  currentUserId: string;
  /** The rough estimate from src/lib/costs.ts, to log real spend against. */
  estimateUsd: number;
  /** The destination's currency, pre-selected because it's what you'll spend. */
  destinationCurrency: string | null;
};

export default function TripExpenses({
  tripId,
  expenses,
  participants,
  currentUserId,
  estimateUsd,
  destinationCurrency,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [currency, setCurrency] = useState(destinationCurrency ?? "USD");

  const summary = useMemo(
    () =>
      summarizeExpenses(
        expenses.map((e) => ({ ...e, spentOn: new Date(e.spentOn) })),
        participants
      ),
    [expenses, participants]
  );

  const nameFor = (id: string) => participants.find((p) => p.id === id)?.name ?? "Someone";

  const spent = summary.totalMinorUsd / 100;
  const pctOfEstimate = estimateUsd > 0 ? Math.min(100, Math.round((spent / estimateUsd) * 100)) : 0;
  const overBudget = estimateUsd > 0 && spent > estimateUsd;

  function submit(formData: FormData) {
    startTransition(async () => {
      await addExpense(tripId, formData);
      setShowForm(false);
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      await removeExpense(tripId, id);
    });
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <section className="rounded-panel bg-paper p-6 shadow-paper">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-display text-xl text-ink">
            <Receipt size={19} className="text-ink/35" /> Expenses
          </h2>
          <p className="mt-1 font-body text-sm text-ink/60">
            What you actually spent, against the estimate — and who owes whom at the end.
          </p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="btn-pill btn-pill-primary shrink-0 !px-4 !py-1.5 !text-xs"
        >
          <Plus size={13} /> Log spend
        </button>
      </div>

      {/* --- Real spend against the estimate. */}
      <div className="mt-5 rounded-card bg-paperDark px-4 py-3.5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="font-display text-3xl tabular-nums text-ink">{formatUsd(spent)}</p>
          {estimateUsd > 0 && (
            <p className="font-body text-sm text-ink/55">
              of {formatUsd(estimateUsd)} estimated
            </p>
          )}
        </div>
        {estimateUsd > 0 && (
          <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-ink/8">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                overBudget ? "bg-stampRed" : "bg-forest"
              }`}
              style={{ width: `${overBudget ? 100 : pctOfEstimate}%` }}
            />
          </div>
        )}
        {overBudget && (
          <p className="mt-2 font-body text-xs text-stampRed">
            {formatUsd(spent - estimateUsd)} over the estimate. The estimate is a rough per-day
            model, not a budget you agreed to — worth updating the tier if it&apos;s consistently off.
          </p>
        )}
        {summary.unconvertedCount > 0 && (
          <p className="mt-2 font-body text-xs text-ink/50">
            {summary.unconvertedCount} expense{summary.unconvertedCount === 1 ? "" : "s"} in a
            currency the free ECB rate feed doesn&apos;t carry, so {summary.unconvertedCount === 1 ? "it isn't" : "they aren't"}{" "}
            in this total or the settlement. Listed below either way.
          </p>
        )}
      </div>

      {showForm && (
        <form action={submit} className="mt-4 space-y-3 rounded-card bg-paperDark p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className="font-stamp text-[11px] uppercase tracking-wide text-ink/45">What was it</span>
              <input
                id={`exp-label-${tripId}`}
                name="label"
                required
                placeholder="Dinner in Kyoto"
                className="rounded-card bg-paper px-3 py-1.5 font-body text-sm text-ink placeholder:text-ink/40 focus:outline-none focus:ring-2 focus:ring-ink/10"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="font-stamp text-[11px] uppercase tracking-wide text-ink/45">Category</span>
              <select
                id={`exp-category-${tripId}`}
                name="category"
                defaultValue="food"
                className="rounded-card bg-paper px-3 py-1.5 font-body text-sm text-ink focus:outline-none focus:ring-2 focus:ring-ink/10"
              >
                {EXPENSE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {EXPENSE_CATEGORY_LABELS[c]}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="font-stamp text-[11px] uppercase tracking-wide text-ink/45">Amount</span>
              <input
                id={`exp-amount-${tripId}`}
                name="amount"
                type="number"
                step="0.01"
                min="0.01"
                required
                className="rounded-card bg-paper px-3 py-1.5 font-body text-sm tabular-nums text-ink focus:outline-none focus:ring-2 focus:ring-ink/10"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="font-stamp text-[11px] uppercase tracking-wide text-ink/45">Currency</span>
              <input
                id={`exp-currency-${tripId}`}
                name="currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value.toUpperCase().slice(0, 3))}
                maxLength={3}
                className="rounded-card bg-paper px-3 py-1.5 font-body text-sm uppercase text-ink focus:outline-none focus:ring-2 focus:ring-ink/10"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="font-stamp text-[11px] uppercase tracking-wide text-ink/45">When</span>
              <input
                id={`exp-date-${tripId}`}
                name="spentOn"
                type="date"
                defaultValue={today}
                className="rounded-card bg-paper px-3 py-1.5 font-body text-sm text-ink focus:outline-none focus:ring-2 focus:ring-ink/10"
              />
            </label>
          </div>

          {participants.length > 1 && (
            <fieldset>
              <legend className="font-stamp text-[11px] uppercase tracking-wide text-ink/45">
                Split between
              </legend>
              <div className="mt-1.5 flex flex-wrap gap-3">
                {participants.map((p) => (
                  <label key={p.id} className="flex items-center gap-1.5">
                    <input
                      id={`exp-split-${tripId}-${p.id}`}
                      type="checkbox"
                      name="splitWith"
                      value={p.id}
                      defaultChecked
                      className="h-3.5 w-3.5 accent-teal"
                    />
                    <span className="font-body text-sm text-ink/75">
                      {p.id === currentUserId ? "You" : p.name}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          <button
            type="submit"
            disabled={isPending}
            className="btn-pill btn-pill-accent !px-4 !py-1.5 !text-xs disabled:opacity-50"
          >
            {isPending ? "Saving…" : "Save expense"}
          </button>
        </form>
      )}

      {/* --- Settle up. */}
      {summary.settlements.length > 0 && (
        <div className="mt-5">
          <h3 className="font-stamp text-[11px] uppercase tracking-wide text-ink/45">Settle up</h3>
          <ul className="mt-2 space-y-1.5">
            {summary.settlements.map((s, i) => (
              <li
                key={`${s.fromUserId}-${s.toUserId}-${i}`}
                className="flex flex-wrap items-center gap-2 rounded-card bg-paperDark px-3.5 py-2 font-body text-sm"
              >
                <span className={s.fromUserId === currentUserId ? "font-semibold text-ink" : "text-ink/75"}>
                  {s.fromUserId === currentUserId ? "You" : nameFor(s.fromUserId)}
                </span>
                <ArrowRight size={13} className="text-ink/30" />
                <span className={s.toUserId === currentUserId ? "font-semibold text-ink" : "text-ink/75"}>
                  {s.toUserId === currentUserId ? "you" : nameFor(s.toUserId)}
                </span>
                <span className="ml-auto font-semibold tabular-nums text-coralDark">
                  {formatUsd(s.amountMinorUsd / 100)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* --- Where it went. */}
      {Object.keys(summary.byCategory).length > 0 && (
        <div className="mt-5 flex flex-wrap gap-x-5 gap-y-1">
          {EXPENSE_CATEGORIES.filter((c) => summary.byCategory[c]).map((c) => (
            <span key={c} className="font-body text-xs text-ink/55">
              {EXPENSE_CATEGORY_LABELS[c]}{" "}
              <span className="font-semibold tabular-nums text-ink/75">
                {formatUsd(summary.byCategory[c] / 100)}
              </span>
            </span>
          ))}
        </div>
      )}

      {/* --- The log. */}
      <div className="mt-5">
        {expenses.length === 0 ? (
          <p className="rounded-card bg-paperDark px-4 py-3 font-body text-sm text-ink/55">
            Nothing logged yet. Once you&apos;re travelling, this is where the real number lives.
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {expenses.map((e) => {
              const splitCount = parseSplit(e.splitBetween).length || 1;
              return (
                <li key={e.id} className="group flex items-baseline gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="font-body text-sm text-ink">{e.label}</p>
                    <p className="font-body text-xs text-ink/45">
                      {EXPENSE_CATEGORY_LABELS[e.category] ?? e.category} ·{" "}
                      {new Date(e.spentOn).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        timeZone: "UTC",
                      })}{" "}
                      · {e.paidById === currentUserId ? "you paid" : `${e.paidByName} paid`}
                      {splitCount > 1 ? ` · split ${splitCount} ways` : ""}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-body text-sm font-semibold tabular-nums text-ink">
                      {formatCurrency(fromMinor(e.amountMinor, e.currency), e.currency, 2)}
                    </p>
                    {e.currency !== "USD" && (
                      <p className="font-body text-[11px] tabular-nums text-ink/40">
                        {e.amountMinorUsd === null
                          ? "no USD rate"
                          : `≈ ${formatUsd(e.amountMinorUsd / 100)}`}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => remove(e.id)}
                    disabled={isPending}
                    className="shrink-0 text-ink/20 opacity-0 transition-opacity hover:text-stampRed group-hover:opacity-100 disabled:opacity-50"
                    aria-label={`Delete ${e.label}`}
                  >
                    <Trash2 size={14} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
