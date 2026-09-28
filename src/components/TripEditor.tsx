"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowUp, ArrowDown, Trash2, Plus, Save, CheckCircle2, Users, Link2, Copy, RefreshCw, CalendarRange, MapPin, Globe, EyeOff } from "lucide-react";
import { updateTripDays, updateTripStatus, deleteTrip, ensureShareToken, removeCollaborator, updateTripPlanning, setTripPublic } from "@/lib/actions";
import { estimateTripCost, getBudgetBreakdown, formatUsd, type CostTier } from "@/lib/costs";
import { TRIP_STATUSES, type TripDay, type TripStatus } from "@/lib/types";
import { createClient } from "@/utils/supabase/client";
import StatusPill from "./StatusPill";

type Collaborator = { userId: string; name: string; email: string };

type Props = {
  tripId: string;
  initialTitle: string;
  initialStatus: TripStatus;
  initialCostTier: string;
  initialDays: TripDay[];
  isOwner: boolean;
  shareToken: string | null;
  collaborators: Collaborator[];
  /** yyyy-mm-dd, ready for <input type="date">, or "" when unset. */
  initialStartDate: string;
  initialEndDate: string;
  initialDestination: string;
  /** Countries we have researched visa rules or country facts for — offered
   *  as suggestions so a typo doesn't silently break every entry check. */
  knownDestinations: string[];
  initialIsPublic: boolean;
  initialPublicToken: string | null;
};

export default function TripEditor({
  tripId,
  initialTitle,
  initialStatus,
  initialCostTier,
  initialDays,
  isOwner,
  shareToken,
  collaborators,
  initialStartDate,
  initialEndDate,
  initialDestination,
  knownDestinations,
  initialIsPublic,
  initialPublicToken,
}: Props) {
  const router = useRouter();
  const [title, setTitle] = useState(initialTitle);
  const [status, setStatus] = useState<TripStatus>(initialStatus);
  const [costTier, setCostTier] = useState<CostTier>((initialCostTier as CostTier) ?? "mid");
  const [days, setDays] = useState<TripDay[]>(initialDays);
  const [isPending, startTransition] = useTransition();
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [remoteUpdate, setRemoteUpdate] = useState(false);

  const estimatedCost = useMemo(() => estimateTripCost(days.length, costTier), [days.length, costTier]);

  // Live sync: when a co-traveler saves (or joins), Supabase Realtime fires
  // an UPDATE event for this trip's row (RLS-scoped to owner+collaborators,
  // so nobody else can subscribe to it even knowing the trip id). Rather
  // than silently overwrite whatever this person is mid-typing, surface a
  // banner and let them pull the latest on their own terms.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`trip-${tripId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "UserTrip", filter: `id=eq.${tripId}` },
        () => setRemoteUpdate(true)
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [tripId]);

  const [token, setToken] = useState(shareToken);
  const [collaboratorList, setCollaboratorList] = useState(collaborators);
  const [copied, setCopied] = useState(false);
  // Server and the pre-hydration client render both need the *same* markup,
  // so this starts as the relative path (window isn't available on the
  // server) and only gains the real origin after mount — a post-hydration
  // state update, not a mismatch.
  const [inviteOrigin, setInviteOrigin] = useState("");
  useEffect(() => {
    setInviteOrigin(window.location.origin);
  }, []);

  function createInvite() {
    startTransition(async () => {
      const newToken = await ensureShareToken(tripId);
      setToken(newToken);
    });
  }

  function copyInviteLink() {
    if (!token) return;
    const url = `${window.location.origin}/trip/${tripId}/join?token=${token}`;
    navigator.clipboard.writeText(url).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      },
      () => {
        // Clipboard write can be denied by browser/permissions policy —
        // fall back to a manual copy instead of leaving the click silently
        // do nothing (or throwing an unhandled rejection).
        window.prompt("Copy this invite link:", url);
      }
    );
  }

  function removeCoTraveler(userId: string) {
    if (!confirm("Remove this co-traveler? They'll lose access to edit this trip.")) return;
    startTransition(async () => {
      await removeCollaborator(tripId, userId);
      setCollaboratorList((list) => list.filter((c) => c.userId !== userId));
    });
  }

  function refreshFromRemote() {
    setRemoteUpdate(false);
    router.refresh();
  }

  // --- Dates + destination. Saved on their own rather than with the day plan:
  // --- they change what the whole page can compute, so the page needs to
  // --- re-render server-side afterwards, and router.refresh() does that.
  const [startDate, setStartDate] = useState(initialStartDate);
  const [endDate, setEndDate] = useState(initialEndDate);
  const [destination, setDestination] = useState(initialDestination);
  const [planningSaved, setPlanningSaved] = useState(false);

  const dateError =
    startDate && endDate && endDate < startDate ? "End date is before the start date." : null;

  function savePlanning() {
    if (dateError) return;
    startTransition(async () => {
      const fd = new FormData();
      fd.set("startDate", startDate);
      fd.set("endDate", endDate);
      fd.set("destinationCountry", destination);
      await updateTripPlanning(tripId, fd);
      setPlanningSaved(true);
      setTimeout(() => setPlanningSaved(false), 2500);
      router.refresh();
    });
  }

  const nights = useMemo(() => {
    if (!startDate || !endDate) return null;
    const a = Date.parse(`${startDate}T00:00:00Z`);
    const b = Date.parse(`${endDate}T00:00:00Z`);
    if (Number.isNaN(a) || Number.isNaN(b) || b < a) return null;
    return Math.round((b - a) / 86_400_000);
  }, [startDate, endDate]);

  // --- Read-only public link.
  const [isPublic, setIsPublic] = useState(initialIsPublic);
  const [publicToken, setPublicToken] = useState(initialPublicToken);
  const [publicCopied, setPublicCopied] = useState(false);

  function togglePublic() {
    const next = !isPublic;
    if (
      next &&
      !confirm(
        "Publish a read-only link to this trip? Anyone with the link will be able to see the day plan, dates and destination — but not edit it, and not your expenses."
      )
    ) {
      return;
    }
    startTransition(async () => {
      const token = await setTripPublic(tripId, next);
      setIsPublic(next);
      setPublicToken(token);
    });
  }

  function copyPublicLink() {
    if (!publicToken) return;
    const url = `${window.location.origin}/t/${publicToken}`;
    navigator.clipboard.writeText(url).then(
      () => {
        setPublicCopied(true);
        setTimeout(() => setPublicCopied(false), 2000);
      },
      () => {
        window.prompt("Copy this public link:", url);
      }
    );
  }

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

      {remoteUpdate && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-panel bg-teal/10 px-5 py-3.5">
          <span className="font-body text-sm text-ink/75">
            A co-traveler just updated this trip.
          </span>
          <button
            onClick={refreshFromRemote}
            className="flex items-center gap-1.5 font-body text-xs font-semibold text-teal hover:underline"
          >
            <RefreshCw size={13} /> Refresh to see their changes
          </button>
        </div>
      )}

      {status === "completed" ? (
        <div className="-mx-1 flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/illustration-trip-complete.jpg" alt="" className="h-32 w-auto" />
        </div>
      ) : (
        <div className="-mx-5 overflow-hidden rounded-hero sm:-mx-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/flatlay-trip-planning.jpg" alt="" className="h-32 w-full object-cover sm:h-44" />
        </div>
      )}

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

      <section className="rounded-panel bg-paper p-5 shadow-paper">
        <h2 className="flex items-center gap-2 font-display text-lg text-ink">
          <CalendarRange size={17} className="text-ink/35" /> Dates &amp; destination
        </h2>
        <p className="mt-1 font-body text-xs text-ink/50">
          Entry requirements, holidays, climate and currency all key off these — they&apos;re what
          turns a wish list into a trip.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <label className="flex flex-col gap-1.5">
            <span className="font-stamp text-[11px] uppercase tracking-wide text-ink/45">
              Leaving
            </span>
            <input
              id="trip-start-date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="rounded-card bg-paperDark px-3 py-1.5 font-body text-sm text-ink focus:outline-none focus:ring-2 focus:ring-ink/10"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="font-stamp text-[11px] uppercase tracking-wide text-ink/45">
              Coming home
            </span>
            <input
              id="trip-end-date"
              type="date"
              value={endDate}
              min={startDate || undefined}
              onChange={(e) => setEndDate(e.target.value)}
              className="rounded-card bg-paperDark px-3 py-1.5 font-body text-sm text-ink focus:outline-none focus:ring-2 focus:ring-ink/10"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="font-stamp text-[11px] uppercase tracking-wide text-ink/45">
              Destination country
            </span>
            <input
              id="trip-destination"
              list="known-destinations"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder="e.g. Japan"
              className="rounded-card bg-paperDark px-3 py-1.5 font-body text-sm text-ink placeholder:text-ink/40 focus:outline-none focus:ring-2 focus:ring-ink/10"
            />
            <datalist id="known-destinations">
              {knownDestinations.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </label>
        </div>

        {dateError && (
          <p className="mt-2 font-body text-xs text-stampRed">{dateError}</p>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            onClick={savePlanning}
            disabled={isPending || Boolean(dateError)}
            className="btn-pill btn-pill-primary !px-4 !py-1.5 !text-xs disabled:opacity-50"
          >
            <MapPin size={13} /> Save dates &amp; destination
          </button>
          {nights !== null && (
            <span className="font-body text-xs text-ink/55">
              {nights} night{nights === 1 ? "" : "s"}
            </span>
          )}
          {planningSaved && (
            <span className="flex items-center gap-1 font-body text-xs text-forest">
              <CheckCircle2 size={13} /> Saved.
            </span>
          )}
        </div>
      </section>

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

      <section className="rounded-panel bg-paper p-5 shadow-paper">
        <h2 className="flex items-center gap-2 font-display text-lg text-ink">
          <Users size={17} className="text-ink/35" /> Co-travelers
        </h2>

        {collaboratorList.length === 0 && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src="/illustration-collaborative-planning.jpg" alt="" className="mx-auto mt-2 h-28 w-auto" />
        )}

        {collaboratorList.length > 0 && (
          <div className="mt-3 space-y-2">
            {collaboratorList.map((c) => (
              <div key={c.userId} className="flex items-center justify-between rounded-card bg-paperDark px-3.5 py-2">
                <div>
                  <p className="font-body text-sm text-ink">{c.name}</p>
                  <p className="font-body text-xs text-ink/50">{c.email}</p>
                </div>
                {isOwner && (
                  <button
                    onClick={() => removeCoTraveler(c.userId)}
                    className="font-body text-xs text-stampRed hover:underline"
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {isOwner ? (
          token ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Link2 size={14} className="text-ink/40" />
              <span className="truncate font-body text-xs text-ink/55">
                {inviteOrigin}/trip/{tripId}/join?token={token}
              </span>
              <button
                onClick={copyInviteLink}
                className="flex shrink-0 items-center gap-1 font-body text-xs font-semibold text-coral hover:underline"
              >
                <Copy size={12} /> {copied ? "Copied!" : "Copy link"}
              </button>
            </div>
          ) : (
            <button
              onClick={createInvite}
              disabled={isPending}
              className="btn-pill btn-pill-primary !mt-3 !px-4 !py-1.5 !text-xs disabled:opacity-50"
            >
              <Link2 size={13} /> Create invite link
            </button>
          )
        ) : (
          collaboratorList.length === 0 && (
            <p className="mt-2 font-body text-xs text-ink/50">Only the trip owner can invite co-travelers.</p>
          )
        )}

        {isOwner && (
          <div className="mt-5 border-t border-line pt-4">
            <p className="font-stamp text-[11px] uppercase tracking-wide text-ink/45">
              Public link
            </p>
            <p className="mt-1 font-body text-xs text-ink/55">
              A read-only page anyone can open — no account needed. Different from the invite
              link above, which lets whoever follows it edit the trip.
            </p>
            {isPublic && publicToken ? (
              <div className="mt-3 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Globe size={14} className="text-forest" />
                  <span className="truncate font-body text-xs text-ink/55">
                    {inviteOrigin}/t/{publicToken}
                  </span>
                  <button
                    onClick={copyPublicLink}
                    className="flex shrink-0 items-center gap-1 font-body text-xs font-semibold text-coral hover:underline"
                  >
                    <Copy size={12} /> {publicCopied ? "Copied!" : "Copy link"}
                  </button>
                </div>
                <button
                  onClick={togglePublic}
                  disabled={isPending}
                  className="flex items-center gap-1 font-body text-xs text-stampRed hover:underline disabled:opacity-50"
                >
                  <EyeOff size={12} /> Unpublish — the link stops working for everyone
                </button>
              </div>
            ) : (
              <button
                onClick={togglePublic}
                disabled={isPending}
                className="btn-pill btn-pill-primary !mt-3 !px-4 !py-1.5 !text-xs disabled:opacity-50"
              >
                <Globe size={13} /> Publish a read-only link
              </button>
            )}
          </div>
        )}
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
        {isOwner && (
          <button
            onClick={handleDelete}
            className="ml-auto flex items-center gap-1 font-body text-sm text-stampRed hover:underline"
          >
            <Trash2 size={14} /> Delete trip
          </button>
        )}
      </div>
    </div>
  );
}

function renumber(days: TripDay[]): TripDay[] {
  return days.map((d, i) => ({ ...d, dayNumber: i + 1 }));
}
