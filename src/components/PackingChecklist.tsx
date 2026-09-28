"use client";

import { useMemo, useOptimistic, useState, useTransition } from "react";
import { Backpack, Plus, Trash2, UserCheck } from "lucide-react";
import {
  addPackingItem,
  removePackingItem,
  setPackingItemClaim,
  setPackingItemPacked,
} from "@/lib/actions";
import type { PackingSection } from "@/lib/packing";

export type SavedPackingItem = {
  id: string;
  label: string;
  category: string;
  packed: boolean;
  claimedBy: string | null;
  claimantName: string | null;
  isCustom: boolean;
};

type Props = {
  tripId: string;
  /** The rule-generated starting list from src/lib/packing.ts. */
  sections: PackingSection[];
  /** Rows that exist because someone ticked or claimed something. */
  savedItems: SavedPackingItem[];
  currentUserId: string;
  currentUserName: string;
};

type Row = {
  label: string;
  category: string;
  packed: boolean;
  claimedBy: string | null;
  claimantName: string | null;
  savedId: string | null;
  isCustom: boolean;
};

/**
 * The generated list is the skeleton; the saved rows are the state laid over
 * it. A generated item with no row yet is simply unpacked and unclaimed — the
 * row gets created by the first tick, which is why the server actions upsert
 * on (tripId, label) rather than requiring an id.
 */
export default function PackingChecklist({
  tripId,
  sections,
  savedItems,
  currentUserId,
  currentUserName,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [newLabel, setNewLabel] = useState("");

  const savedByLabel = useMemo(() => {
    const map = new Map<string, SavedPackingItem>();
    for (const item of savedItems) map.set(item.label, item);
    return map;
  }, [savedItems]);

  const groups = useMemo(() => {
    const result: { title: string; rows: Row[] }[] = sections.map((section) => ({
      title: section.title,
      rows: section.items.map((label) => {
        const saved = savedByLabel.get(label);
        return {
          label,
          category: section.title,
          packed: saved?.packed ?? false,
          claimedBy: saved?.claimedBy ?? null,
          claimantName: saved?.claimantName ?? null,
          savedId: saved?.id ?? null,
          isCustom: false,
        };
      }),
    }));

    const generatedLabels = new Set(sections.flatMap((s) => s.items));
    const extras = savedItems.filter((i) => !generatedLabels.has(i.label));
    if (extras.length > 0) {
      result.push({
        title: "Added by you",
        rows: extras.map((i) => ({
          label: i.label,
          category: i.category,
          packed: i.packed,
          claimedBy: i.claimedBy,
          claimantName: i.claimantName,
          savedId: i.id,
          isCustom: true,
        })),
      });
    }
    return result;
  }, [sections, savedItems, savedByLabel]);

  const allRows = groups.flatMap((g) => g.rows);
  // useOptimistic so a tick lands instantly instead of waiting on a round
  // trip — a 25-item checklist is exactly where that latency is felt.
  const [optimistic, applyOptimistic] = useOptimistic(
    allRows,
    (state: Row[], patch: { label: string; packed?: boolean; claimedBy?: string | null; claimantName?: string | null }) =>
      state.map((r) => (r.label === patch.label ? { ...r, ...patch } : r))
  );

  const optimisticByLabel = useMemo(() => {
    const map = new Map<string, Row>();
    for (const r of optimistic) map.set(r.label, r);
    return map;
  }, [optimistic]);

  const packedCount = optimistic.filter((r) => r.packed).length;
  const total = optimistic.length;
  const pct = total === 0 ? 0 : Math.round((packedCount / total) * 100);

  function togglePacked(row: Row) {
    const next = !row.packed;
    startTransition(async () => {
      applyOptimistic({ label: row.label, packed: next });
      await setPackingItemPacked(tripId, row.label, row.category, next);
    });
  }

  function toggleClaim(row: Row) {
    const mine = row.claimedBy === currentUserId;
    startTransition(async () => {
      applyOptimistic({
        label: row.label,
        claimedBy: mine ? null : currentUserId,
        claimantName: mine ? null : currentUserName,
      });
      await setPackingItemClaim(tripId, row.label, row.category, !mine);
    });
  }

  function add() {
    const label = newLabel.trim();
    if (!label) return;
    const fd = new FormData();
    fd.set("label", label);
    startTransition(async () => {
      setNewLabel("");
      await addPackingItem(tripId, fd);
    });
  }

  function remove(row: Row) {
    if (!row.savedId) return;
    startTransition(async () => {
      await removePackingItem(tripId, row.savedId!);
    });
  }

  return (
    <section className="rounded-panel bg-paper p-6 shadow-paper">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-display text-xl text-ink">
            <Backpack size={19} className="text-ink/35" /> Packing
          </h2>
          <p className="mt-1 font-body text-sm text-ink/60">
            Tick things off, and claim what you&apos;re bringing so two of you don&apos;t both pack
            the adapter.
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="font-display text-2xl tabular-nums text-ink">
            {packedCount}
            <span className="text-ink/35">/{total}</span>
          </p>
          <p className="font-body text-xs text-ink/45">packed</p>
        </div>
      </div>

      <div
        className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-paperDark"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Packing progress"
      >
        <div
          className="h-full rounded-full bg-forest transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="mt-6 space-y-6">
        {groups.map((group) => (
          <div key={group.title}>
            <h3 className="font-stamp text-[11px] uppercase tracking-wide text-ink/45">
              {group.title}
            </h3>
            <ul className="mt-2.5 space-y-1">
              {group.rows.map((baseRow) => {
                const row = optimisticByLabel.get(baseRow.label) ?? baseRow;
                const claimedByMe = row.claimedBy === currentUserId;
                return (
                  <li
                    key={row.label}
                    className="group flex items-start gap-3 rounded-card px-2 py-1.5 transition-colors hover:bg-paperDark"
                  >
                    <input
                      id={`pack-${tripId}-${encodeURIComponent(row.label).slice(0, 40)}`}
                      type="checkbox"
                      checked={row.packed}
                      onChange={() => togglePacked(row)}
                      disabled={isPending}
                      className="mt-1 h-4 w-4 shrink-0 cursor-pointer accent-forest"
                    />
                    <label
                      htmlFor={`pack-${tripId}-${encodeURIComponent(row.label).slice(0, 40)}`}
                      className={`flex-1 cursor-pointer font-body text-sm ${
                        row.packed ? "text-ink/35 line-through" : "text-ink/80"
                      }`}
                    >
                      {row.label}
                    </label>
                    <div className="flex shrink-0 items-center gap-2">
                      {row.claimedBy && !claimedByMe && (
                        <span className="rounded-full bg-teal/12 px-2 py-0.5 font-body text-[11px] font-semibold text-teal">
                          {row.claimantName ?? "Claimed"}
                        </span>
                      )}
                      <button
                        onClick={() => toggleClaim(row)}
                        disabled={isPending}
                        className={`flex items-center gap-1 rounded-full px-2 py-0.5 font-body text-[11px] transition-colors disabled:opacity-50 ${
                          claimedByMe
                            ? "bg-teal/12 font-semibold text-teal"
                            : "text-ink/35 hover:bg-ink/5 hover:text-ink/70"
                        }`}
                        aria-label={claimedByMe ? `You're bringing ${row.label}` : `Claim ${row.label}`}
                      >
                        <UserCheck size={11} /> {claimedByMe ? "You're bringing it" : "I'll bring it"}
                      </button>
                      {row.isCustom && (
                        <button
                          onClick={() => remove(row)}
                          disabled={isPending}
                          className="text-ink/25 opacity-0 transition-opacity hover:text-stampRed group-hover:opacity-100 disabled:opacity-50"
                          aria-label={`Remove ${row.label}`}
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <input
          id={`pack-new-${tripId}`}
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder="Add something of your own"
          className="min-w-0 flex-1 rounded-card bg-paperDark px-3 py-1.5 font-body text-sm text-ink placeholder:text-ink/40 focus:outline-none focus:ring-2 focus:ring-ink/10"
        />
        <button
          onClick={add}
          disabled={isPending || !newLabel.trim()}
          className="btn-pill btn-pill-primary !px-4 !py-1.5 !text-xs disabled:opacity-40"
        >
          <Plus size={13} /> Add
        </button>
      </div>
    </section>
  );
}
