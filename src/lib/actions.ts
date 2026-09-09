"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "./prisma";
import { getCurrentUser } from "./currentUser";
import type { TripDay, TripStatus } from "./types";
import { normalizeCountryInput } from "./countries";

function itineraryDaysToTripDays(days: { dayNumber: number; title: string; activities: string; driveTime: string | null; lodgingSuggestion: string | null; coffeeWifiSpot: string | null }[]): TripDay[] {
  return days
    .sort((a, b) => a.dayNumber - b.dayNumber)
    .map((d) => ({
      dayNumber: d.dayNumber,
      title: d.title,
      activities: d.activities.split("|").filter(Boolean),
      driveTime: d.driveTime,
      lodgingSuggestion: d.lodgingSuggestion,
      coffeeWifiSpot: d.coffeeWifiSpot,
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
    },
  });

  revalidatePath("/my-trips");
  redirect(`/trip/${trip.id}`);
}

export async function updateTripStatus(tripId: string, status: TripStatus) {
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

export async function deleteTrip(tripId: string) {
  await prisma.userTrip.delete({ where: { id: tripId } });
  revalidatePath("/my-trips");
  redirect("/my-trips");
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
