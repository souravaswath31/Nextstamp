"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { prisma } from "./prisma";
import { getCurrentUser } from "./currentUser";
import { getTripWithAccess } from "./trips";
import { createClient } from "@/utils/supabase/server";
import type { TripDay, TripStatus } from "./types";
import { normalizeCountryInput } from "./countries";
import { EXPENSE_CATEGORIES, type ExpenseCategory } from "./expenses";
import { fromMinor, getRate, toMinor } from "./currency";

function itineraryDaysToTripDays(days: { dayNumber: number; title: string; activities: string; driveTime: string | null; lodgingSuggestion: string | null; coffeeWifiSpot: string | null; latitude: number | null; longitude: number | null }[]): TripDay[] {
  return days
    .sort((a, b) => a.dayNumber - b.dayNumber)
    .map((d) => ({
      dayNumber: d.dayNumber,
      title: d.title,
      activities: d.activities.split("|").filter(Boolean),
      driveTime: d.driveTime,
      lodgingSuggestion: d.lodgingSuggestion,
      coffeeWifiSpot: d.coffeeWifiSpot,
      // Carried over so the trip can draw its own route map without having to
      // look back at the itinerary it came from.
      latitude: d.latitude,
      longitude: d.longitude,
    }));
}

export async function createTripFromItinerary(itineraryId: string) {
  const user = await getCurrentUser();
  const itinerary = await prisma.itinerary.findUnique({
    where: { id: itineraryId },
    include: { days: true },
  });
  if (!itinerary) throw new Error("Itinerary not found");

  const trip = await prisma.userTrip.create({
    data: {
      userId: user.id,
      itineraryId: itinerary.id,
      title: itinerary.title,
      status: "idea",
      costTier: itinerary.costTier,
      customDaysJson: JSON.stringify(itineraryDaysToTripDays(itinerary.days)),
      shareToken: randomUUID(),
      // An itinerary already knows where it goes, so don't make the user
      // retype it. Multi-country itineraries (e.g. "Maldives, Sri Lanka")
      // take the first — entry rules have to resolve against one country,
      // and the user can change it.
      destinationCountry: itinerary.countries.split(",")[0]?.trim() || null,
    },
  });

  revalidatePath("/my-trips");
  redirect(`/trip/${trip.id}`);
}

export async function createBlankTrip(formData: FormData) {
  const user = await getCurrentUser();
  const title = String(formData.get("title") ?? "New trip").trim() || "New trip";

  const trip = await prisma.userTrip.create({
    data: {
      userId: user.id,
      title,
      status: "idea",
      costTier: "mid",
      customDaysJson: JSON.stringify([
        { dayNumber: 1, title: "Day 1", activities: [] },
      ] satisfies TripDay[]),
      shareToken: randomUUID(),
    },
  });

  revalidatePath("/my-trips");
  redirect(`/trip/${trip.id}`);
}

export async function updateTripStatus(tripId: string, status: TripStatus) {
  const user = await getCurrentUser();
  const { canEdit } = await getTripWithAccess(tripId, user.id);
  if (!canEdit) throw new Error("You don't have access to this trip.");

  const data: { status: TripStatus; completedDate?: Date | null } = { status };
  // Set completedDate when marking complete, and just as importantly, clear
  // it when moving away from "completed" — otherwise a trip un-completed
  // and moved back to planning keeps counting toward "completed this year"
  // while simultaneously showing up in active trips.
  if (status === "completed") data.completedDate = new Date();
  else data.completedDate = null;
  await prisma.userTrip.update({ where: { id: tripId }, data });
  revalidatePath(`/trip/${tripId}`);
  revalidatePath("/my-trips");
  revalidatePath("/");
}

export async function updateTripDays(tripId: string, days: TripDay[], costTier: string, title: string) {
  const user = await getCurrentUser();
  const { canEdit } = await getTripWithAccess(tripId, user.id);
  if (!canEdit) throw new Error("You don't have access to this trip.");

  const safeTitle = title.trim() || "Untitled trip";
  await prisma.userTrip.update({
    where: { id: tripId },
    data: {
      customDaysJson: JSON.stringify(days),
      costTier,
      title: safeTitle,
    },
  });
  revalidatePath(`/trip/${tripId}`);
  revalidatePath("/my-trips");
}

// Trips created before invite links existed have no shareToken yet —
// backfill one on first visit to the owner's own trip rather than requiring
// a migration pass over old rows.
export async function ensureShareToken(tripId: string): Promise<string> {
  const user = await getCurrentUser();
  const { trip, isOwner } = await getTripWithAccess(tripId, user.id);
  if (!trip || !isOwner) throw new Error("Only the trip owner can create an invite link.");
  if (trip.shareToken) return trip.shareToken;

  const shareToken = randomUUID();
  await prisma.userTrip.update({ where: { id: tripId }, data: { shareToken } });
  return shareToken;
}

export async function deleteTrip(tripId: string) {
  const user = await getCurrentUser();
  const { trip, isOwner } = await getTripWithAccess(tripId, user.id);
  // Deleting (as opposed to editing) is owner-only — a co-traveler removing
  // the whole trip out from under everyone else is a different, much more
  // destructive action than editing a day plan.
  if (!trip || !isOwner) throw new Error("Only the trip owner can delete it.");

  await prisma.userTrip.delete({ where: { id: tripId } });
  revalidatePath("/my-trips");
  redirect("/my-trips");
}

// Invite links use the trip's shareToken (generated at creation) rather
// than a separate email — no email infrastructure exists yet, so sharing
// happens by whatever channel the owner likes (text, Slack, etc.).
export async function joinTripViaToken(tripId: string, token: string) {
  const user = await getCurrentUser();

  const trip = await prisma.userTrip.findUnique({ where: { id: tripId } });
  if (!trip || !trip.shareToken || trip.shareToken !== token) {
    throw new Error("This invite link is invalid.");
  }

  if (trip.userId === user.id) {
    redirect(`/trip/${tripId}`);
  }

  await prisma.tripCollaborator.upsert({
    where: { tripId_userId: { tripId, userId: user.id } },
    create: { tripId, userId: user.id },
    update: {},
  });

  // Bump updatedAt so everyone already viewing the trip picks up the new
  // collaborator via the same Realtime subscription used for day-plan edits,
  // instead of needing a second channel just for membership changes.
  await prisma.userTrip.update({ where: { id: tripId }, data: { updatedAt: new Date() } });

  revalidatePath(`/trip/${tripId}`);
  redirect(`/trip/${tripId}`);
}

export async function removeCollaborator(tripId: string, collaboratorUserId: string) {
  const user = await getCurrentUser();
  const { trip, isOwner } = await getTripWithAccess(tripId, user.id);
  if (!trip || !isOwner) throw new Error("Only the trip owner can remove a co-traveler.");

  await prisma.tripCollaborator.delete({
    where: { tripId_userId: { tripId, userId: collaboratorUserId } },
  });
  revalidatePath(`/trip/${tripId}`);
}

// --- Trip planning: dates + destination ------------------------------------
// These three fields (startDate, endDate, destinationCountry) are what every
// date- or place-aware feature reads — entry readiness, holidays during the
// stay, climate for the travel month, currency, advisories, flight links.
// Before they existed a trip was just a title and a day list.
export async function updateTripPlanning(tripId: string, formData: FormData) {
  const user = await getCurrentUser();
  const { canEdit } = await getTripWithAccess(tripId, user.id);
  if (!canEdit) throw new Error("You don't have access to this trip.");

  const startRaw = String(formData.get("startDate") ?? "").trim();
  const endRaw = String(formData.get("endDate") ?? "").trim();
  const destinationRaw = String(formData.get("destinationCountry") ?? "").trim();

  // Dates come from <input type="date"> as yyyy-mm-dd. Parsed as UTC noon so
  // the stored instant lands on the intended calendar day in every timezone —
  // a bare "2027-03-14" parsed as UTC midnight displays as March 13 for
  // anyone west of Greenwich.
  const parseDay = (v: string): Date | null => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
    return new Date(`${v}T12:00:00.000Z`);
  };

  const startDate = startRaw ? parseDay(startRaw) : null;
  let endDate = endRaw ? parseDay(endRaw) : null;
  // An end before the start is a typo, not an instruction. Drop it rather
  // than storing a negative-length trip that every downstream calculation
  // then has to defend against.
  if (startDate && endDate && endDate < startDate) endDate = null;

  await prisma.userTrip.update({
    where: { id: tripId },
    data: {
      startDate,
      endDate,
      destinationCountry: destinationRaw ? normalizeCountryInput(destinationRaw) : null,
    },
  });

  revalidatePath(`/trip/${tripId}`);
  revalidatePath("/my-trips");
  revalidatePath("/");
}

// --- Public read-only sharing ----------------------------------------------
// publicToken is a separate secret from shareToken on purpose: shareToken
// grants edit access to whoever follows it, so it must never be the thing
// posted publicly. See the UserTrip model comment.
export async function setTripPublic(tripId: string, isPublic: boolean): Promise<string | null> {
  const user = await getCurrentUser();
  const { trip, isOwner } = await getTripWithAccess(tripId, user.id);
  if (!trip || !isOwner) throw new Error("Only the trip owner can publish a trip.");

  if (!isPublic) {
    // Rotate the token off as well as flipping the flag, so a previously
    // shared link is dead rather than dormant.
    await prisma.userTrip.update({
      where: { id: tripId },
      data: { isPublic: false, publicToken: null },
    });
    revalidatePath(`/trip/${tripId}`);
    return null;
  }

  const publicToken = trip.publicToken ?? randomUUID();
  await prisma.userTrip.update({
    where: { id: tripId },
    data: { isPublic: true, publicToken },
  });
  revalidatePath(`/trip/${tripId}`);
  return publicToken;
}

// --- Packing list ----------------------------------------------------------
// Rows are created on first interaction rather than materialised up front, so
// the generated list in src/lib/packing.ts stays the source of truth until
// somebody actually ticks or claims something. An upsert keyed on
// (tripId, label) is what makes that work.
export async function setPackingItemPacked(
  tripId: string,
  label: string,
  category: string,
  packed: boolean
) {
  const user = await getCurrentUser();
  const { canEdit } = await getTripWithAccess(tripId, user.id);
  if (!canEdit) throw new Error("You don't have access to this trip.");

  const clean = label.trim();
  if (!clean) return;

  await prisma.tripPackingItem.upsert({
    where: { tripId_label: { tripId, label: clean } },
    create: { tripId, label: clean, category, packed },
    update: { packed },
  });
  revalidatePath(`/trip/${tripId}`);
}

export async function setPackingItemClaim(
  tripId: string,
  label: string,
  category: string,
  claim: boolean
) {
  const user = await getCurrentUser();
  const { canEdit } = await getTripWithAccess(tripId, user.id);
  if (!canEdit) throw new Error("You don't have access to this trip.");

  const clean = label.trim();
  if (!clean) return;

  await prisma.tripPackingItem.upsert({
    where: { tripId_label: { tripId, label: clean } },
    create: { tripId, label: clean, category, claimedBy: claim ? user.id : null },
    update: { claimedBy: claim ? user.id : null },
  });
  revalidatePath(`/trip/${tripId}`);
}

export async function addPackingItem(tripId: string, formData: FormData) {
  const user = await getCurrentUser();
  const { canEdit } = await getTripWithAccess(tripId, user.id);
  if (!canEdit) throw new Error("You don't have access to this trip.");

  const label = String(formData.get("label") ?? "").trim();
  if (!label) return;

  await prisma.tripPackingItem.upsert({
    where: { tripId_label: { tripId, label } },
    create: { tripId, label, category: "custom", isCustom: true },
    update: {},
  });
  revalidatePath(`/trip/${tripId}`);
}

export async function removePackingItem(tripId: string, itemId: string) {
  const user = await getCurrentUser();
  const { canEdit } = await getTripWithAccess(tripId, user.id);
  if (!canEdit) throw new Error("You don't have access to this trip.");

  // Scoped by tripId as well as id so a valid item id from another trip
  // can't be deleted through a trip the caller does have access to.
  await prisma.tripPackingItem.deleteMany({ where: { id: itemId, tripId } });
  revalidatePath(`/trip/${tripId}`);
}

// --- Saved places ----------------------------------------------------------
// The bridge between the content library and the planner. Saving is separate
// from slotting into a day because when you're browsing you rarely know yet
// which day something belongs on — see the TripSavedPlace model comment.

export type SavePlaceInput = {
  name: string;
  note?: string | null;
  sourceKind?: string | null;
  sourceSlug?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

export async function savePlaceToTrip(tripId: string, place: SavePlaceInput) {
  const user = await getCurrentUser();
  const { canEdit } = await getTripWithAccess(tripId, user.id);
  if (!canEdit) throw new Error("You don't have access to this trip.");

  const name = place.name.trim();
  if (!name) return;

  // Upsert rather than create: saving the same place twice from the guide is a
  // thing people do, and it should be a no-op rather than an error.
  await prisma.tripSavedPlace.upsert({
    where: { tripId_name: { tripId, name } },
    create: {
      tripId,
      name,
      note: place.note?.trim() || null,
      sourceKind: place.sourceKind ?? null,
      sourceSlug: place.sourceSlug ?? null,
      latitude: place.latitude ?? null,
      longitude: place.longitude ?? null,
      addedById: user.id,
    },
    update: {},
  });

  revalidatePath(`/trip/${tripId}`);
}

export async function removeSavedPlace(tripId: string, placeId: string) {
  const user = await getCurrentUser();
  const { canEdit } = await getTripWithAccess(tripId, user.id);
  if (!canEdit) throw new Error("You don't have access to this trip.");

  // Scoped by tripId too, so an id from another trip can't be deleted through
  // one the caller does have access to.
  await prisma.tripSavedPlace.deleteMany({ where: { id: placeId, tripId } });
  revalidatePath(`/trip/${tripId}`);
}

/**
 * Move a saved place onto a specific day of the plan.
 *
 * Appends to that day's activities and marks the saved place as used rather
 * than deleting it — people want to see what they've already placed, and
 * making it vanish reads like it was lost.
 */
export async function addSavedPlaceToDay(tripId: string, placeId: string, dayNumber: number) {
  const user = await getCurrentUser();
  const { trip, canEdit } = await getTripWithAccess(tripId, user.id);
  if (!trip || !canEdit) throw new Error("You don't have access to this trip.");

  const place = await prisma.tripSavedPlace.findFirst({ where: { id: placeId, tripId } });
  if (!place) return;

  let days: TripDay[] = [];
  try {
    const parsed = JSON.parse(trip.customDaysJson);
    if (Array.isArray(parsed)) days = parsed;
  } catch {
    return; // A corrupted day plan is handled on the page; don't compound it.
  }

  const target = days.find((d) => d.dayNumber === dayNumber);
  if (!target) return;

  const entry = place.note ? `${place.name} — ${place.note}` : place.name;
  if (!target.activities.includes(entry)) {
    target.activities = [...target.activities, entry];
  }

  await prisma.userTrip.update({
    where: { id: tripId },
    data: { customDaysJson: JSON.stringify(days) },
  });
  await prisma.tripSavedPlace.update({
    where: { id: placeId },
    data: { usedOnDay: dayNumber },
  });

  revalidatePath(`/trip/${tripId}`);
}

// --- Expenses --------------------------------------------------------------
export async function addExpense(tripId: string, formData: FormData) {
  const user = await getCurrentUser();
  const { trip, canEdit } = await getTripWithAccess(tripId, user.id);
  if (!trip || !canEdit) throw new Error("You don't have access to this trip.");

  const label = String(formData.get("label") ?? "").trim();
  const category = String(formData.get("category") ?? "other").trim();
  const currency = (String(formData.get("currency") ?? "USD").trim() || "USD").toUpperCase();
  const amountRaw = String(formData.get("amount") ?? "").trim();
  const spentOnRaw = String(formData.get("spentOn") ?? "").trim();

  const amount = Number(amountRaw);
  if (!label || !Number.isFinite(amount) || amount <= 0) return;
  if (!EXPENSE_CATEGORIES.includes(category as ExpenseCategory)) return;

  const amountMinor = toMinor(amount, currency);

  // The rate that applied on the day it was spent is the honest one, so it's
  // stored rather than recomputed at read time. A currency the ECB feed
  // doesn't carry stores null — summarizeExpenses reports those separately
  // instead of quietly excluding them.
  let amountMinorUsd: number | null = amountMinor;
  let fxRate: number | null = 1;
  if (currency !== "USD") {
    const rate = await getRate(currency, "USD");
    if (rate.supported && rate.rate) {
      fxRate = rate.rate;
      amountMinorUsd = Math.round(fromMinor(amountMinor, currency) * rate.rate * 100);
    } else {
      fxRate = null;
      amountMinorUsd = null;
    }
  }

  // Everyone on the trip splits it by default — owner plus collaborators.
  const participantIds = [trip.userId, ...trip.collaborators.map((c) => c.userId)];
  const requested = formData.getAll("splitWith").map(String).filter(Boolean);
  const split = requested.length > 0
    ? requested.filter((id) => participantIds.includes(id))
    : participantIds;

  await prisma.tripExpense.create({
    data: {
      tripId,
      paidById: user.id,
      label,
      category,
      amountMinor,
      currency,
      amountMinorUsd,
      fxRate,
      spentOn: /^\d{4}-\d{2}-\d{2}$/.test(spentOnRaw)
        ? new Date(`${spentOnRaw}T12:00:00.000Z`)
        : new Date(),
      splitBetween: (split.length > 0 ? split : [user.id]).join(","),
    },
  });

  revalidatePath(`/trip/${tripId}`);
}

export async function removeExpense(tripId: string, expenseId: string) {
  const user = await getCurrentUser();
  const { canEdit } = await getTripWithAccess(tripId, user.id);
  if (!canEdit) throw new Error("You don't have access to this trip.");

  await prisma.tripExpense.deleteMany({ where: { id: expenseId, tripId } });
  revalidatePath(`/trip/${tripId}`);
}

export async function updatePassportExpiry(formData: FormData) {
  const user = await getCurrentUser();
  const raw = String(formData.get("passportExpiry") ?? "").trim();

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passportExpiry: /^\d{4}-\d{2}-\d{2}$/.test(raw)
        ? new Date(`${raw}T12:00:00.000Z`)
        : null,
    },
  });
  revalidatePath("/profile");
  revalidatePath("/my-trips");
  revalidatePath("/");
}

export async function updatePassportCountry(formData: FormData) {
  const user = await getCurrentUser();
  const raw = String(formData.get("passportCountry") ?? "").trim();
  if (!raw) return;
  const passportCountry = normalizeCountryInput(raw);
  await prisma.user.update({ where: { id: user.id }, data: { passportCountry } });
  revalidatePath("/profile");
  revalidatePath("/explore");
  revalidatePath("/itinerary", "layout");
}

export async function addHeldDocument(formData: FormData) {
  const user = await getCurrentUser();
  const rawCountry = String(formData.get("country") ?? "").trim();
  const subtype = String(formData.get("subtype") ?? "").trim();
  const validUntilRaw = String(formData.get("validUntil") ?? "").trim();

  if (!rawCountry) return;
  const country = normalizeCountryInput(rawCountry);

  await prisma.heldDocument.create({
    data: {
      userId: user.id,
      type: "visa",
      country,
      subtype: subtype || null,
      validUntil: validUntilRaw ? new Date(validUntilRaw) : null,
    },
  });
  revalidatePath("/profile");
  revalidatePath("/explore");
  revalidatePath("/itinerary", "layout");
}

export async function removeHeldDocument(documentId: string) {
  await prisma.heldDocument.delete({ where: { id: documentId } });
  revalidatePath("/profile");
  revalidatePath("/explore");
}

// One-time step after a new magic-link sign-in — creates the User row that
// getCurrentUser() (src/lib/currentUser.ts) expects to find from then on.
export async function completeOnboarding(formData: FormData) {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser || !authUser.email) redirect("/login");

  const name = String(formData.get("name") ?? "").trim() || authUser.email.split("@")[0];
  const rawPassport = String(formData.get("passportCountry") ?? "").trim();
  if (!rawPassport) return;
  const passportCountry = normalizeCountryInput(rawPassport);

  // Optional at signup — see the note on the field in the onboarding page.
  const rawExpiry = String(formData.get("passportExpiry") ?? "").trim();
  const passportExpiry = /^\d{4}-\d{2}-\d{2}$/.test(rawExpiry)
    ? new Date(`${rawExpiry}T12:00:00.000Z`)
    : null;

  await prisma.user.upsert({
    where: { id: authUser.id },
    update: { name, passportCountry, passportExpiry },
    create: { id: authUser.id, email: authUser.email, name, passportCountry, passportExpiry },
  });

  redirect("/");
}

export async function signOutAction() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  await supabase.auth.signOut();
  redirect("/login");
}
