"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateTripDays, updateTripStatus, deleteTrip } from "@/lib/actions";
import { estimateTripCost, getBudgetBreakdown, formatUsd, type CostTier } from "@/lib/costs";
import { TRIP_STATUSES, type TripDay, type TripStatus } from "@/lib/types";
import StatusPill from "./StatusPill";

type Props = {
  tripId: string;
  initialTitle: string;
  initialStatus: TripStatus;
  initialCostTier: string;
  initialDays: TripDay[];
};

export default function TripEditor({
  tripId,
  initialTitle,
  initialStatus,
  initialCostTier,
  initialDays,
}: Props) {
  const router = useRouter();
  const [title, setTitle] = useState(initialTitle);
  const [status, setStatus] = useState<TripStatus>(initialStatus);
  const [costTier, setCostTier] = useState<CostTier>((initialCostTier as CostTier) ?? "mid");
  const [days, setDays] = useState<TripDay[]>(initialDays);
  const [isPending, startTransition] = useTransition();
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const estimatedCost = useMemo(() => estimateTripCost(days.length, costTier), [days.length, costTier]);

  function moveDay(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= days.length) return;
    const next = [...days];
    [next[index], next[target]] = [next[target], next[index]];
    setDays(renumber(next));
  }

  function removeDay(index: number) {
    setDays(renumber(days.filter((_, i) => i !== index)));
  }

  function addDay() {
    setDays(renumber([...days, { dayNumber: days.length + 1, title: `Day ${days.length + 1}`, activities: [] }]));
  }

  function updateDay(index: number, patch: Partial<TripDay>) {
    setDays(days.map((d, i) => (i === index ? { ...d, ...patch } : d)));
  }

  function save() {
    startTransition(async () => {
      await updateTripDays(tripId, days, costTier, title);
      setSavedAt(Date.now());
    });
  }

  function changeStatus(newStatus: TripStatus) {
    setStatus(newStatus);
    startTransition(async () => {
      await updateTripStatus(tripId, newStatus);
    });
  }

  function handleDelete() {
    if (!confirm("Delete this trip? This can't be undone.")) return;
    startTransition(async () => {
      await deleteTrip(tripId);
      router.push("/my-trips");
    });
  }

  return (
    <div className="space-y-8">
      <button
        onClick={() => router.back()}
        className="inline-flex items-center gap-1.5 font-body text-sm text-ink/60 transition-colors hover:text-ink"
      >
        <span aria-hidden="true">←</span> Back
      </button>
      <div>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full border-none bg-transparent font-display text-3xl text-ink outline-none sm:text-4xl"
        />
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <StatusPill status={status} />
          <select
            value={status}
            onChange={(e) => changeStatus(e.target.value as TripStatus)}
            className="border border-line bg-paper px-2 py-1 font-body text-xs text-ink"
          >
            {TRIP_STATUSES.map((s) => (
              <option key={s} value={s}>
                Move to: {s}
              </option>
            ))}
          </select>
        </div>
      </div>

      <section className="flex flex-wrap items-end gap-6 border border-line p-4">
        <label className="flex flex-col gap-1">
          <span className="font-stamp text-[11px] uppercase tracking-wide text-ink/50">
            Budget tier
          </span>
          <select
            value={costTier}
            onChange={(e) => setCostTier(e.target.value as CostTier)}
            className="border border-line bg-paper px-2 py-1 font-body text-sm text-ink"
          >
            <option value="budget">Budget</option>
            <option value="mid">Mid</option>
            <option value="splurge">Splurge</option>
          </select>
        </label>
        <div>
          <p className="font-stamp text-[11px] uppercase tracking-wide text-ink/50">
            Estimated cost
          </p>
          <p className="font-display text-2xl text-coralDark">{formatUsd(estimatedCost)}</p>
          <p className="font-body text-xs text-ink/50">
            {days.length} day{days.length === 1 ? "" : "s"} · rough estimate, not a quote
          </p>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
            {(() => {
              const b = getBudgetBreakdown(estimatedCost);
              return (
                <>
                  <span className="font-body text-xs text-ink/50">Lodging {formatUsd(b.lodging)}</span>
                  <span className="font-body text-xs text-ink/50">Food {formatUsd(b.food)}</span>
                  <span className="font-body text-xs text-ink/50">Transport {formatUsd(b.transport)}</span>
                  <span className="font-body text-xs text-ink/50">Activities {formatUsd(b.activities)}</span>
                </>
              );
            })()}
          </div>
        </div>
      </section>

      <section>
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-xl text-ink">Day by day</h2>
          <button
            onClick={addDay}
            className="border border-ink px-3 py-1.5 font-body text-sm text-ink hover:bg-ink hover:text-paper"
          >
            + Add day
          </button>
        </div>

        <div className="mt-4 space-y-4">
          {days.length === 0 && (
            <p className="border border-line bg-paperDark px-4 py-3 font-body text-sm text-ink/60">
              No days yet — add one to start building the plan.
            </p>
          )}
          {days.map((day, index) => (
            <div key={index} className="border border-line p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="font-stamp text-sm text-stamp">Day {day.dayNumber}</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => moveDay(index, -1)}
                    disabled={index === 0}
                    className="px-2 font-body text-sm text-ink/60 hover:text-ink disabled:opacity-30"
                    aria-label="Move day earlier"
                  >
                    ↑
                  </button>
                  <button
                    onClick={() => moveDay(index, 1)}
                    disabled={index === days.length - 1}
                    className="px-2 font-body text-sm text-ink/60 hover:text-ink disabled:opacity-30"
                    aria-label="Move day later"
                  >
                    ↓
                  </button>
                  <button
                    onClick={() => removeDay(index)}
                    className="px-2 font-body text-sm text-stampRed hover:underline"
                  >
                    Remove
                  </button>
                </div>
              </div>

              <input
                value={day.title}
                onChange={(e) => updateDay(index, { title: e.target.value })}
                className="mt-2 w-full border-b border-line bg-transparent py-1 font-display text-lg text-ink outline-none focus:border-ink"
              />

              <textarea
                value={day.activities.join("\n")}
                onChange={(e) =>
                  updateDay(index, { activities: e.target.value.split("\n").filter(Boolean) })
                }
                placeholder="One activity per line"
                rows={3}
                className="mt-2 w-full border border-line bg-paper px-2 py-1.5 font-body text-sm text-ink placeholder:text-ink/40"
              />

              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                <input
                  value={day.driveTime ?? ""}
                  onChange={(e) => updateDay(index, { driveTime: e.target.value })}
                  placeholder="Drive time"
                  className="border border-line bg-paper px-2 py-1 font-body text-xs text-ink placeholder:text-ink/40"
                />
                <input
                  value={day.lodgingSuggestion ?? ""}
                  onChange={(e) => updateDay(index, { lodgingSuggestion: e.target.value })}
                  placeholder="Lodging"
                  className="border border-line bg-paper px-2 py-1 font-body text-xs text-ink placeholder:text-ink/40"
                />
                <input
                  value={day.coffeeWifiSpot ?? ""}
                  onChange={(e) => updateDay(index, { coffeeWifiSpot: e.target.value })}
                  placeholder="Remote-work stop"
                  className="border border-line bg-paper px-2 py-1 font-body text-xs text-ink placeholder:text-ink/40"
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="flex items-center gap-4 pb-8">
        <button
          onClick={save}
          disabled={isPending}
          className="rounded-full border border-coral bg-coral px-6 py-3 font-body text-sm font-semibold text-white shadow-sm hover:bg-coralDark disabled:opacity-50"
        >
          {isPending ? "Saving..." : "Save changes"}
        </button>
        {savedAt && <span className="font-body text-xs text-forest">Saved.</span>}
        <button
          onClick={handleDelete}
          className="ml-auto font-body text-sm text-stampRed hover:underline"
        >
          Delete trip
        </button>
      </div>
    </div>
  );
}

function renumber(days: TripDay[]): TripDay[] {
  return days.map((d, i) => ({ ...d, dayNumber: i + 1 }));
}
