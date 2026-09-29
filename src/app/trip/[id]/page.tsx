import { notFound } from "next/navigation";
import Link from "next/link";
import { Plane, Hotel, ExternalLink, BookOpen } from "lucide-react";
import { getCurrentUser } from "@/lib/currentUser";
import { getTripWithAccess } from "@/lib/trips";
import { prisma } from "@/lib/prisma";
import TripEditor from "@/components/TripEditor";
import EntryReadiness from "@/components/EntryReadiness";
import DestinationBriefing from "@/components/DestinationBriefing";
import PackingChecklist from "@/components/PackingChecklist";
import TripExpenses from "@/components/TripExpenses";
import Reveal from "@/components/Reveal";
import { buildReadinessReport } from "@/lib/readiness";
import { climateForDateRange } from "@/lib/countryFacts";
import { getHolidaysDuring, getUpcomingHolidays } from "@/lib/holidays";
import { getRate } from "@/lib/currency";
import { getFcdoAdvisory, getStateDeptAdvisory } from "@/lib/advisories";
import { generatePackingList } from "@/lib/packing";
import { estimateTripCost, type CostTier } from "@/lib/costs";
import { flightSearchLinks, staySearchLink } from "@/lib/flights";
import { getWeatherOutlook } from "@/lib/weather";
import RouteMap from "@/components/RouteMap";
import SavedPlaces from "@/components/SavedPlaces";
import WeatherPanel from "@/components/WeatherPanel";
import type { TripDay, TripStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

/** yyyy-mm-dd for <input type="date">, read in UTC to match how we store it. */
function toDateInput(d: Date | null): string {
  return d ? d.toISOString().slice(0, 10) : "";
}

export default async function TripPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  const { trip, isOwner, canEdit } = await getTripWithAccess(params.id, user.id);

  // Not found (rather than a 403) for both a missing trip and one this user
  // has no access to — a real trip ID with editing enforced but *readable*
  // to a wrong guesser would still leak that the ID exists.
  if (!trip || !canEdit) notFound();

  // Defend against a corrupted or hand-edited customDaysJson value — a
  // parse failure here would otherwise take down the whole page instead
  // of just this one trip.
  let days: TripDay[] = [];
  let corrupted = false;
  try {
    const parsed = JSON.parse(trip.customDaysJson);
    days = Array.isArray(parsed) ? parsed : [];
    if (!Array.isArray(parsed)) corrupted = true;
  } catch {
    corrupted = true;
  }

  // The readiness report is the thing that needs dates + destination +
  // passport expiry; it also hands back the resolved visa status and country
  // facts, so the briefing below doesn't re-query for them.
  const report = await buildReadinessReport(user, trip);
  const fact = report.countryFact;

  // Everything the briefing needs, in parallel — four independent network
  // calls (two advisory sources, a rate, a holiday calendar), none of which
  // should serialize behind the others. All of them degrade to null/[].
  const [holidays, rate, fcdo, stateDept, savedPacking, expenses, savedPlaces, knownDestinations] =
    await Promise.all([
      trip.startDate
        ? getHolidaysDuring(fact?.iso2, trip.startDate, trip.endDate)
        : getUpcomingHolidays(fact?.iso2, 4),
      fact ? getRate("USD", fact.currencyCode) : Promise.resolve(null),
      trip.destinationCountry ? getFcdoAdvisory(trip.destinationCountry) : Promise.resolve(null),
      fact ? getStateDeptAdvisory(fact.country) : Promise.resolve(null),
      prisma.tripPackingItem.findMany({
        where: { tripId: trip.id },
        include: { claimant: { select: { name: true } } },
        orderBy: { createdAt: "asc" },
      }),
      prisma.tripExpense.findMany({
        where: { tripId: trip.id },
        include: { paidBy: { select: { name: true } } },
        orderBy: { spentOn: "desc" },
      }),
      prisma.tripSavedPlace.findMany({
        where: { tripId: trip.id },
        orderBy: { createdAt: "asc" },
      }),
      // Suggestions for the destination field: anywhere we have a researched
      // visa rule for this passport, plus anywhere we have country facts.
      Promise.all([
        prisma.visaRule.findMany({
          where: { passportCountry: user.passportCountry },
          distinct: ["destinationCountry"],
          select: { destinationCountry: true },
        }),
        prisma.countryFact.findMany({ select: { country: true } }),
      ]).then(([rules, facts]) =>
        Array.from(
          new Set([...rules.map((r) => r.destinationCountry), ...facts.map((f) => f.country)])
        ).sort()
      ),
    ]);

  // Packing categories come from the linked itinerary's tags where there is
  // one; a from-scratch trip gets the universal list only.
  const itineraryCategories = trip.itineraryId
    ? (
        await prisma.itinerary.findUnique({
          where: { id: trip.itineraryId },
          select: { category: true },
        })
      )?.category
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean) ?? []
    : [];
  const packingSections = generatePackingList(itineraryCategories);

  const participants = [
    { id: trip.userId, name: trip.user.id === user.id ? user.name : trip.user.name },
    ...trip.collaborators.map((c) => ({ id: c.userId, name: c.user.name })),
  ];

  const estimate = estimateTripCost(days.length, (trip.costTier as CostTier) ?? "mid");
  const flights = flightSearchLinks(
    user.homeBaseLocation,
    trip.destinationCountry,
    trip.startDate,
    trip.endDate
  );
  const stay = staySearchLink(trip.destinationCountry, trip.startDate, trip.endDate);

  const climate = climateForDateRange(fact?.climate ?? [], trip.startDate, trip.endDate);

  // Route stops for the map. Trips created from an itinerary carry coordinates
  // in their own day plan; trips created before that field existed don't, so
  // fall back to the source itinerary's days matched on day number. A
  // from-scratch trip has neither and simply gets no map.
  let routeDays: { dayNumber: number; title: string; latitude: number; longitude: number }[] =
    days
      .filter((d): d is TripDay & { latitude: number; longitude: number } =>
        typeof d.latitude === "number" && typeof d.longitude === "number"
      )
      .map((d) => ({
        dayNumber: d.dayNumber,
        title: d.title,
        latitude: d.latitude,
        longitude: d.longitude,
      }));

  if (routeDays.length === 0 && trip.itineraryId) {
    const sourceDays = await prisma.itineraryDay.findMany({
      where: { itineraryId: trip.itineraryId, latitude: { not: null } },
      select: { dayNumber: true, title: true, latitude: true, longitude: true },
      orderBy: { dayNumber: "asc" },
    });
    const byDay = new Map(days.map((d) => [d.dayNumber, d.title]));
    routeDays = sourceDays
      .filter((d) => byDay.has(d.dayNumber))
      .map((d) => ({
        dayNumber: d.dayNumber,
        // Prefer the trip's own (possibly edited) title over the itinerary's.
        title: byDay.get(d.dayNumber) ?? d.title,
        latitude: d.latitude!,
        longitude: d.longitude!,
      }));
  }

  // A real forecast when the trip is close enough for one to exist, the
  // destination's climate normals when it isn't — see src/lib/weather.ts for
  // why we don't buy the long-range "forecast" endpoint to paper over that.
  // Queried by the guide's own reference city: "Japan" resolves to somewhere
  // arbitrary, "Tokyo" doesn't.
  const weather = await getWeatherOutlook(
    fact?.climateReferenceCity ?? trip.destinationCountry,
    trip.startDate,
    trip.endDate,
    climate,
    fact?.climateReferenceCity ?? null
  );

  return (
    <div className="space-y-4">
      {corrupted && (
        <p className="rounded-panel bg-stampRed/5 px-5 py-4 font-body text-sm text-stampRed">
          This trip&apos;s day-by-day plan couldn&apos;t be read and was reset to empty — sorry about that.
          Everything else (title, status, budget tier) is intact. Rebuild the days below and save.
        </p>
      )}
      {!isOwner && (
        <p className="rounded-panel bg-teal/5 px-5 py-4 font-body text-sm text-ink/70">
          Shared with you by {trip.user.name} — you can edit the day plan, but only they can
          delete the trip or remove co-travelers.
        </p>
      )}

      <TripEditor
        // Remounts (resetting all local editor state to fresh server data)
        // whenever the row actually changes — the mechanism the Realtime
        // "refresh to see the latest" banner relies on, since router.refresh()
        // alone wouldn't reset state a client component already holds.
        key={trip.updatedAt.getTime()}
        tripId={trip.id}
        initialTitle={trip.title}
        initialStatus={trip.status as TripStatus}
        initialCostTier={trip.costTier}
        initialDays={days}
        isOwner={isOwner}
        shareToken={trip.shareToken}
        collaborators={trip.collaborators.map((c) => ({
          userId: c.userId,
          name: c.user.name,
          email: c.user.email,
        }))}
        initialStartDate={toDateInput(trip.startDate)}
        initialEndDate={toDateInput(trip.endDate)}
        initialDestination={trip.destinationCountry ?? ""}
        knownDestinations={knownDestinations}
        initialIsPublic={trip.isPublic}
        initialPublicToken={trip.publicToken}
      />

      <Reveal>
        <EntryReadiness report={report} />
      </Reveal>

      {routeDays.length > 0 && (
        <Reveal>
          <RouteMap
            heading="Your route"
            stops={routeDays}
            unmappedCount={days.length - routeDays.length}
          />
        </Reveal>
      )}

      {weather && (
        <Reveal>
          <WeatherPanel outlook={weather} />
        </Reveal>
      )}

      {fact && (
        <Reveal>
          <div className="space-y-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-display text-2xl text-ink">
                Know before you go — {fact.country}
              </h2>
              <Link
                href={`/country/${encodeURIComponent(fact.country.toLowerCase().replace(/\s+/g, "-"))}`}
                className="btn-ghost !text-xs"
              >
                <BookOpen size={13} /> Full country guide
              </Link>
            </div>
            {/* climate is deliberately empty here: WeatherPanel above already
                owns the climate/forecast answer for this trip's dates, and
                showing the same months twice on one page is noise. The public
                share page and the country guide still pass real rows. */}
            <DestinationBriefing
              fact={fact}
              holidays={holidays}
              holidaysAreForTrip={Boolean(trip.startDate)}
              climate={[]}
              rate={rate}
              fcdo={fcdo}
              stateDept={stateDept}
            />
          </div>
        </Reveal>
      )}

      {!fact && trip.destinationCountry && (
        <p className="rounded-panel bg-paper px-5 py-4 font-body text-sm text-ink/60 shadow-paper">
          We don&apos;t have a researched country guide for {trip.destinationCountry} yet — no
          climate, money, plug, emergency-number or phrasebook data. The visa answer and entry
          checks above still apply.
        </p>
      )}

      <Reveal>
        <SavedPlaces
          tripId={trip.id}
          places={savedPlaces.map((p) => ({
            id: p.id,
            name: p.name,
            note: p.note,
            sourceKind: p.sourceKind,
            sourceSlug: p.sourceSlug,
            usedOnDay: p.usedOnDay,
            hasCoords: p.latitude !== null && p.longitude !== null,
          }))}
          dayNumbers={days.map((d) => d.dayNumber)}
        />
      </Reveal>

      <Reveal>
        <PackingChecklist
          tripId={trip.id}
          sections={packingSections}
          savedItems={savedPacking.map((p) => ({
            id: p.id,
            label: p.label,
            category: p.category,
            packed: p.packed,
            claimedBy: p.claimedBy,
            claimantName: p.claimant?.name ?? null,
            isCustom: p.isCustom,
          }))}
          currentUserId={user.id}
          currentUserName={user.name}
        />
      </Reveal>

      <Reveal>
        <TripExpenses
          tripId={trip.id}
          expenses={expenses.map((e) => ({
            id: e.id,
            label: e.label,
            category: e.category,
            amountMinor: e.amountMinor,
            currency: e.currency,
            amountMinorUsd: e.amountMinorUsd,
            spentOn: e.spentOn.toISOString(),
            paidById: e.paidById,
            paidByName: e.paidBy.name,
            splitBetween: e.splitBetween,
          }))}
          participants={participants}
          currentUserId={user.id}
          estimateUsd={estimate}
          destinationCurrency={fact?.currencyCode ?? null}
        />
      </Reveal>

      {/* --- Booking. Deep links rather than an embedded search: there is no
          --- free flight API whose fares we could stand behind, and showing a
          --- price we can't honour would be worse than showing none. */}
      {trip.destinationCountry && (flights.length > 0 || stay) && (
        <Reveal>
          <section className="rounded-panel bg-paper p-6 shadow-paper">
            <h2 className="flex items-center gap-2 font-display text-xl text-ink">
              <Plane size={19} className="text-ink/35" /> Book it
            </h2>
            <p className="mt-1 font-body text-sm text-ink/60">
              We don&apos;t sell flights or quote fares — no free flight API returns prices we could
              stand behind. These hand your dates and route straight to engines that do.
            </p>
            <div className="mt-4 flex flex-wrap gap-2.5">
              {flights.map((l) => (
                <a
                  key={l.provider}
                  href={l.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group rounded-card bg-paperDark px-4 py-3 transition-colors hover:bg-ink/5"
                >
                  <p className="flex items-center gap-1.5 font-body text-sm font-semibold text-ink">
                    <Plane size={13} className="text-ink/40" /> {l.provider}
                    <ExternalLink size={11} className="text-ink/30" />
                  </p>
                  <p className="mt-0.5 max-w-[16rem] font-body text-xs text-ink/50">{l.note}</p>
                </a>
              ))}
              {stay && (
                <a
                  href={stay.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group rounded-card bg-paperDark px-4 py-3 transition-colors hover:bg-ink/5"
                >
                  <p className="flex items-center gap-1.5 font-body text-sm font-semibold text-ink">
                    <Hotel size={13} className="text-ink/40" /> {stay.provider}
                    <ExternalLink size={11} className="text-ink/30" />
                  </p>
                  <p className="mt-0.5 max-w-[16rem] font-body text-xs text-ink/50">{stay.note}</p>
                </a>
              )}
            </div>
          </section>
        </Reveal>
      )}
    </div>
  );
}
