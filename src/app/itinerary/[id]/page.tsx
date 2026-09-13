import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/currentUser";
import { getVisaStatusForUser } from "@/lib/visa";
import { createTripFromItinerary } from "@/lib/actions";
import VisaBadge from "@/components/VisaBadge";
import { CATEGORY_LABELS, CATEGORY_COLOR_CLASSES } from "@/lib/types";
import { generatePackingList } from "@/lib/packing";
import { estimateTripCost, getBudgetBreakdown, formatUsd } from "@/lib/costs";
import BackButton from "@/components/BackButton";
import {
  CalendarDays,
  Sun,
  Wallet,
  Wallet2,
  UtensilsCrossed,
  Car,
  Bed,
  Wifi,
  PackageCheck,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ItineraryDetailPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  const itinerary = await prisma.itinerary.findUnique({
    where: { id: params.id },
    include: { days: { orderBy: { dayNumber: "asc" } }, notes: true },
  });

  if (!itinerary) notFound();

  const countries = itinerary.countries.split(",").filter(Boolean);
  const visaStatuses = await Promise.all(
    countries.map((c) => getVisaStatusForUser(user, c))
  );

  const relatedStateSlugs = itinerary.relatedStateSlugs ? itinerary.relatedStateSlugs.split(",").filter(Boolean) : [];
  const relatedStates = relatedStateSlugs.length > 0
    ? await prisma.stateGuide.findMany({ where: { slug: { in: relatedStateSlugs } } })
    : [];

  const createTrip = createTripFromItinerary.bind(null, itinerary.id);

  return (
    <div className="space-y-8">
      <BackButton label="Back to Explore" />
      <div>
        <p className="font-stamp text-xs uppercase tracking-widest text-ink/50">
          {itinerary.region} · {countries.join(", ")}
        </p>
        <h1 className="mt-1 font-display text-3xl text-ink sm:text-4xl">{itinerary.title}</h1>
        <p className="mt-3 max-w-2xl font-body text-base text-ink/80">{itinerary.description}</p>

        <div className="mt-4 flex flex-wrap gap-2">
          {itinerary.category.split(",").filter(Boolean).map((c) => (
            <span key={c} className={`rounded-full px-2.5 py-0.5 font-body text-xs font-medium ${CATEGORY_COLOR_CLASSES[c] ?? "bg-line/40 text-ink/70"}`}>
              {CATEGORY_LABELS[c] ?? c}
            </span>
          ))}
        </div>
      </div>

      <section className="grid gap-5 border border-line bg-paper p-5 shadow-paper sm:grid-cols-3">
        <div className="flex gap-2.5">
          <CalendarDays size={16} className="mt-0.5 shrink-0 text-coralDark" />
          <div>
            <p className="font-stamp text-[11px] uppercase tracking-wide text-ink/50">
              Duration
            </p>
            <p className="font-body text-sm text-ink">
              {itinerary.durationDaysMin === itinerary.durationDaysMax
                ? `${itinerary.durationDaysMin} days`
                : `${itinerary.durationDaysMin}–${itinerary.durationDaysMax} days`}
            </p>
          </div>
        </div>
        <div className="flex gap-2.5">
          <Sun size={16} className="mt-0.5 shrink-0 text-stamp" />
          <div>
            <p className="font-stamp text-[11px] uppercase tracking-wide text-ink/50">
              Best time
            </p>
            <p className="font-body text-sm text-ink">
              {itinerary.bestTimeMonths.split(",").join(", ")} — {itinerary.bestTimeDescription}
            </p>
          </div>
        </div>
        <div className="flex gap-2.5">
          <Wallet size={16} className="mt-0.5 shrink-0 text-forest" />
          <div>
            <p className="font-stamp text-[11px] uppercase tracking-wide text-ink/50">
              Budget tier
            </p>
            <p className="font-body text-sm capitalize text-ink">{itinerary.costTier}</p>
          </div>
        </div>
      </section>

      <section className="border border-line bg-gradient-to-br from-coral/[0.04] to-transparent p-5 shadow-paper">
        <p className="font-stamp text-[11px] uppercase tracking-wide text-ink/50">
          Estimated cost for {itinerary.durationDaysMin} days, per person
        </p>
        <p className="mt-1 font-display text-3xl text-coralDark">
          {formatUsd(estimateTripCost(itinerary.durationDaysMin, itinerary.costTier as any))}
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(() => {
            const breakdown = getBudgetBreakdown(estimateTripCost(itinerary.durationDaysMin, itinerary.costTier as any));
            return (
              <>
                <BudgetLine icon={Bed} label="Lodging" amount={breakdown.lodging} />
                <BudgetLine icon={UtensilsCrossed} label="Food" amount={breakdown.food} />
                <BudgetLine icon={Car} label="Local transport" amount={breakdown.transport} />
                <BudgetLine icon={Wallet2} label="Activities" amount={breakdown.activities} />
              </>
            );
          })()}
        </div>
        <p className="mt-4 font-body text-xs text-ink/50">
          Rough split based on typical vacation spending patterns, not this destination specifically — doesn't include flights. Adjust the tier once you're planning to see the estimate change.
        </p>
      </section>

      <section>
        <h2 className="font-display text-xl text-ink">Visa status for you</h2>
        <div className="mt-3 space-y-3">
          {countries.map((country, i) => (
            <div key={country} className="border border-line bg-paper p-4 shadow-paper">
              <p className="font-body text-sm font-medium text-ink">{country}</p>
              <div className="mt-2">
                <VisaBadge status={visaStatuses[i]} />
              </div>
              {visaStatuses[i].conditionsText && (
                <p className="mt-2 font-body text-xs text-ink/60">
                  {visaStatuses[i].conditionsText}
                  {visaStatuses[i].maxStayDays
                    ? ` Max stay: ${visaStatuses[i].maxStayDays} days.`
                    : ""}
                </p>
              )}
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="font-display text-xl text-ink">Day by day</h2>
        <div className="mt-4 space-y-0">
          {itinerary.days.map((day, idx) => (
            <div
              key={day.id}
              className={`flex gap-4 py-4 ${idx > 0 ? "ticket-divider" : ""}`}
            >
              <span className="stamp-mark mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center border-stamp font-stamp text-sm font-bold not-italic text-stamp">
                {day.dayNumber}
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="font-display text-lg text-ink">{day.title}</h3>
                <ul className="mt-2 list-inside list-disc font-body text-sm text-ink/80">
                  {day.activities.split("|").filter(Boolean).map((a, i) => (
                    <li key={i}>{a}</li>
                  ))}
                </ul>
                <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1.5 font-body text-xs text-ink/50">
                  {day.driveTime && (
                    <span className="flex items-center gap-1"><Car size={13} /> {day.driveTime}</span>
                  )}
                  {day.lodgingSuggestion && (
                    <span className="flex items-center gap-1"><Bed size={13} /> {day.lodgingSuggestion}</span>
                  )}
                  {day.coffeeWifiSpot && (
                    <span className="flex items-center gap-1"><Wifi size={13} /> {day.coffeeWifiSpot}</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {itinerary.notes.length > 0 && (
        <section>
          <h2 className="font-display text-xl text-ink">Food, drink & culture</h2>
          <p className="mt-1 font-body text-sm text-ink/60">
            What the place actually tastes and sounds like, not just how it looks.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {itinerary.notes.map((note) => (
              <div key={note.id} className="card-lift border border-line border-t-[3px] border-t-catSplurge bg-paper p-4">
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="font-display text-base text-ink">{note.name}</h3>
                  {note.placeType && (
                    <span className="whitespace-nowrap font-stamp text-[10px] uppercase text-ink/40">
                      {note.placeType}
                    </span>
                  )}
                </div>
                <p className="mt-1.5 font-body text-sm text-ink/75">{note.description}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {itinerary.notes.length === 0 && relatedStates.length > 0 && (
        <section>
          <h2 className="font-display text-xl text-ink">Food, drink & culture</h2>
          <p className="mt-1 font-body text-sm text-ink/60">
            This trip's food and culture depth lives in{" "}
            {relatedStates.length === 1 ? "our destination guide for" : "our destination guides for"}{" "}
            {relatedStates.map((s) => s.name).join(" and ")} — not repeated here twice.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {relatedStates.map((s) => (
              <Link
                key={s.id}
                href={`/state/${s.slug}`}
                className="card-lift group block border border-line border-t-[3px] border-t-catSplurge bg-paper p-4 hover:border-ink"
              >
                <h3 className="font-display text-base text-ink group-hover:underline">{s.name} guide →</h3>
                <p className="mt-1.5 font-body text-sm text-ink/75">{s.heroTagline}</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="font-display text-xl text-ink">What to pack</h2>
        <p className="mt-1 font-body text-sm text-ink/60">
          Based on what this trip actually involves — not a generic everything-list.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {generatePackingList(itinerary.category.split(",").filter(Boolean)).map((section) => (
            <div key={section.title} className="card-lift border border-line bg-paper p-4">
              <p className="flex items-center gap-1.5 font-stamp text-[11px] uppercase tracking-wide text-stamp">
                <PackageCheck size={13} /> {section.title}
              </p>
              <ul className="mt-2 list-inside list-disc font-body text-sm text-ink/80">
                {section.items.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <form action={createTrip} className="pt-2">
        <button
          type="submit"
          className="flex items-center gap-2 rounded-full border border-coral bg-coral px-6 py-3 font-body text-sm font-semibold text-white shadow-paper transition-transform hover:-translate-y-0.5 hover:bg-coralDark hover:shadow-paper-lg"
        >
          <Sparkles size={16} /> Start planning this trip
        </button>
      </form>
    </div>
  );
}

function BudgetLine({
  icon: Icon,
  label,
  amount,
}: {
  icon: LucideIcon;
  label: string;
  amount: number;
}) {
  return (
    <div className="flex items-start gap-2">
      <Icon size={15} className="mt-0.5 shrink-0 text-ink/30" />
      <div>
        <p className="font-body text-xs text-ink/50">{label}</p>
        <p className="font-display text-base text-ink">{formatUsd(amount)}</p>
      </div>
    </div>
  );
}
