"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "./prisma";
import { getCurrentUser } from "./currentUser";
import { toMinor } from "./currency";

// The trip fund is a notebook. Nothing here moves money or talks to a bank.

const CURRENCY_RE = /^[A-Z]{3}$/;

function parseAmount(raw: FormDataEntryValue | null): number | null {
  const n = Number(String(raw ?? "").replace(/,/g, "").trim());
  return Number.isFinite(n) && n !== 0 ? n : null;
}

export async function createFund(formData: FormData) {
  const user = await getCurrentUser();
  const name = String(formData.get("name") ?? "").trim().slice(0, 80);
  const currency = String(formData.get("currency") ?? "USD").trim().toUpperCase();
  const target = parseAmount(formData.get("target"));
  if (!name || !CURRENCY_RE.test(currency) || target === null || target <= 0) return;

  const tripIdRaw = String(formData.get("tripId") ?? "");
  // Only link a trip the user owns.
  const trip = tripIdRaw
    ? await prisma.userTrip.findFirst({ where: { id: tripIdRaw, userId: user.id }, select: { id: true } })
    : null;

  await prisma.tripFund.create({
    data: { userId: user.id, name, currency, targetMinor: toMinor(target, currency), tripId: trip?.id ?? null },
  });
  revalidatePath("/wallet");
}

export async function addFundEntry(fundId: string, formData: FormData) {
  const user = await getCurrentUser();
  const fund = await prisma.tripFund.findFirst({ where: { id: fundId, userId: user.id } });
  if (!fund) return;
  const amount = parseAmount(formData.get("amount"));
  if (amount === null) return;
  const direction = String(formData.get("direction") ?? "in");
  const signed = direction === "out" ? -Math.abs(amount) : Math.abs(amount);
  await prisma.tripFundEntry.create({
    data: {
      fundId: fund.id,
      amountMinor: toMinor(signed, fund.currency),
      note: String(formData.get("note") ?? "").trim().slice(0, 120) || null,
    },
  });
  revalidatePath("/wallet");
}

export async function deleteFundEntry(entryId: string) {
  const user = await getCurrentUser();
  await prisma.tripFundEntry.deleteMany({ where: { id: entryId, fund: { userId: user.id } } });
  revalidatePath("/wallet");
}

export async function deleteFund(fundId: string) {
  const user = await getCurrentUser();
  await prisma.tripFund.deleteMany({ where: { id: fundId, userId: user.id } });
  revalidatePath("/wallet");
}
