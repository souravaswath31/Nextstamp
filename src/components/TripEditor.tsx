"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowUp, ArrowDown, Trash2, Plus, Save, CheckCircle2 } from "lucide-react";
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
        <ArrowLeft size={15} /> Back
      </button>
      <div>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full border-none bg-transparent font-display text-4xl tracking-tightest text-ink outline-none sm:text-5xl"
        />
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <StatusPill status={status} />
          <select
            value={status}
            onChange={(e) => changeStatus(e.target.value as TripStatus)}
            className="rounded-full bg-paperDark px-3 py-1 font-body text-xs text-ink focus:outline-none focus:ring-2 focus:ring-ink/10"
          >
            {TRIP_STATUSES.map((s) => (
              <option key={s} value={s}>
                Move to: {s}
              </option>
            ))}
          </select>
        </div>
      </div>

      <section className="flex flex-wrap items-end gap-6 rounded-panel bg-paper p-5 shadow-paper">
        <label className="flex flex-col gap-1.5">
          <span className="font-stamp text-[11px] uppercase tracking-wide text-ink/45">
            Budget tier
          </span>
          <select
            value={costTier}
            onChange={(e) => setCostTier(e.target.value as CostTier)}
            className="rounded-card bg-paperDark px-3 py-1.5 font-body text-sm text-ink focus:outline-none focus:ring-2 focus:ring-ink/10"
          >
            <option value="budget">Budget</option>
            <option value="mid">Mid</option>
            <option value="splurge">Splurge</option>
          </select>
        </label>
        <div>
          <p className="font-stamp text-[11px] uppercase tracking-wide text-ink/45">
            Estimated cost
          </p>
          <p className="font-display text-3xl text-coralDark">{formatUsd(estimatedCost)}</p>
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
          <h2 className="font-display text-2xl text-ink">Day by day</h2>
          <button onClick={addDay} className="btn-pill btn-pill-primary !px-4 !py-2 !text-sm">
            <Plus size={15} /> Add day
          </button>
        </div>

        <div className="mt-5 space-y-4">
          {days.length === 0 && (
            <p className="rounded-panel bg-paperDark px-5 py-4 font-body text-sm text-ink/60">
              No days yet — add one to start building the plan.
            </p>
          )}
          {days.map((day, index) => (
            <div key={index} className="rounded-panel bg-paper p-5 shadow-paper">
              <div className="flex items-center justify-between gap-3">
                <span className="stamp-mark flex h-8 w-8 items-center justify-center border-stamp font-stamp text-xs font-bold text-stamp">
                  {day.dayNumber}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => moveDay(index, -1)}
                    disabled={index === 0}
                    className="rounded-full p-1.5 text-ink/60 hover:bg-ink/5 hover:text-ink disabled:opacity-30"
                    aria-label="Move day earlier"
                  >
                    <ArrowUp size={15} />
                  </button>
                  <button
                    onClick={() => moveDay(index, 1)}
                    disabled={index === days.length - 1}
                    className="rounded-full p-1.5 text-ink/60 hover:bg-ink/5 hover:text-ink disabled:opacity-30"
                    aria-label="Move day later"
                  >
                    <ArrowDown size={15} />
                  </button>
                  <button
                    onClick={() => removeDay(index)}
                    className="flex items-center gap-1 rounded-full px-2.5 py-1.5 font-body text-xs text-stampRed hover:bg-stampRed/5"
                  >
                    <Trash2 size={14} /> Remove
                  </button>
                </div>
              </div>

              <input
                value={day.title}
                onChange={(e) => updateDay(index, { title: e.target.value })}
                className="mt-3 w-full border-b border-line bg-transparent py-1 font-display text-lg text-ink outline-none focus:border-ink"
              />

              <textarea
                value={day.activities.join("\n")}
                onChange={(e) =>
                  updateDay(index, { activities: e.target.value.split("\n").filter(Boolean) })
                }
                placeholder="One activity per line"
                rows={3}
                className="mt-3 w-full rounded-card bg-paperDark px-3 py-2 font-body text-sm text-ink placeholder:text-ink/40 focus:outline-none focus:ring-2 focus:ring-ink/10"
              />

              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                <input
                  value={day.driveTime ?? ""}
                  onChange={(e) => updateDay(index, { driveTime: e.target.value })}
                  placeholder="Drive time"
                  className="rounded-card bg-paperDark px-3 py-1.5 font-body text-xs text-ink placeholder:text-ink/40 focus:outline-none focus:ring-2 focus:ring-ink/10"
                />
                <input
                  value={day.lodgingSuggestion ?? ""}
                  onChange={(e) => updateDay(index, { lodgingSuggestion: e.target.value })}
                  placeholder="Lodging"
                  className="rounded-card bg-paperDark px-3 py-1.5 font-body text-xs text-ink placeholder:text-ink/40 focus:outline-none focus:ring-2 focus:ring-ink/10"
                />
                <input
                  value={day.coffeeWifiSpot ?? ""}
                  onChange={(e) => updateDay(index, { coffeeWifiSpot: e.target.value })}
                  placeholder="Remote-work stop"
                  className="rounded-card bg-paperDark px-3 py-1.5 font-body text-xs text-ink placeholder:text-ink/40 focus:outline-none focus:ring-2 focus:ring-ink/10"
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="flex items-center gap-4 pb-8">
        <button onClick={save} disabled={isPending} className="btn-pill btn-pill-accent disabled:opacity-50">
          <Save size={16} /> {isPending ? "Saving..." : "Save changes"}
        </button>
        {savedAt && (
          <span className="flex items-center gap-1 font-body text-xs text-forest">
            <CheckCircle2 size={14} /> Saved.
          </span>
        )}
        <button
          onClick={handleDelete}
          className="ml-auto flex items-center gap-1 font-body text-sm text-stampRed hover:underline"
        >
          <Trash2 size={14} /> Delete trip
        </button>
      </div>
    </div>
  );
}

function renumber(days: TripDay[]): TripDay[] {
  return days.map((d, i) => ({ ...d, dayNumber: i + 1 }));
}
