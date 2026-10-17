"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "./prisma";
import { getCurrentUser } from "./currentUser";
import { finalizeDraft, realDeps } from "./tripImport/analyze";
import { buildTripRecords, sanitizeStops } from "./tripImport/commit";
import { cleanLabel } from "./tripImport/extraction";
import { normalizeCountryInput } from "./countries";

/**
 * Create the trip from a reviewed draft. The browser sends back the stops the
 * user kept; ordering is recomputed here from the routing service so what is
 * stored never depends on what the browser claims about drive times.
 */
export async function createTripFromImport(importId: string, payloadJson: string): Promise<{ error: string } | never> {
  const user = await getCurrentUser();

  const imp = await prisma.tripImport.findFirst({ where: { id: importId, userId: user.id, tripId: null } });
  if (!imp) return { error: "This import has already been used or has expired. Start again." };

  let payload: { title?: unknown; destinationCountry?: unknown; stops?: unknown };
  try {
    payload = JSON.parse(payloadJson);
  } catch {
    return { error: "Something went wrong reading your choices. Try again." };
  }
  const stops = sanitizeStops(payload.stops);
  if (stops.length === 0) return { error: "Tick at least one stop to build a trip from." };

  const title = cleanLabel(payload.title, 80) || "Trip from a post";
  const country = cleanLabel(payload.destinationCountry, 60);
  const destinationCountry = country ? normalizeCountryInput(country) : null;

  const deps = realDeps();
  const draft = await finalizeDraft({ title, destinationCountry, stops, notes: [] }, deps);
  const { days, places } = buildTripRecords(stops, draft.ordering.kind === "ordered" ? draft.ordering.days : null);

  const trip = await prisma.$transaction(async (tx) => {
    const t = await tx.userTrip.create({
      data: {
        userId: user.id,
        title,
        status: "idea",
        costTier: "mid",
        customDaysJson: JSON.stringify(days),
        shareToken: randomUUID(),
        destinationCountry,
      },
    });
    await tx.tripSavedPlace.createMany({
      data: places.map((p) => ({ ...p, tripId: t.id, addedById: user.id })),
      skipDuplicates: true,
    });
    await tx.tripImport.update({ where: { id: imp.id }, data: { tripId: t.id } });
    return t;
  });

  revalidatePath("/my-trips");
  redirect(`/trip/${trip.id}`);
}

/** Delete what we kept from the post (link and text). The trip and its stops stay. */
export async function deleteImportSource(tripId: string): Promise<void> {
  const user = await getCurrentUser();
  // Owner only: collaborators can read the trip, but the source belongs to whoever imported it.
  await prisma.tripImport.deleteMany({ where: { tripId, userId: user.id } });
  revalidatePath(`/trip/${tripId}`);
}
