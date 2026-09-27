import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getOptionalUser } from "@/lib/currentUser";
import { joinTripViaToken } from "@/lib/actions";

export const dynamic = "force-dynamic";

// Where a trip's shareToken invite link lands. Uses getOptionalUser (not
// getCurrentUser) so an unauthenticated visitor gets sent to /login with
// this exact URL preserved as `next`, instead of losing the invite token
// at a bare /login redirect.
export default async function JoinTripPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { token?: string };
}) {
  const { id } = params;
  const token = searchParams.token;
  if (!token) notFound();

  const user = await getOptionalUser();
  if (!user) {
    const dest = `/trip/${id}/join?token=${token}`;
    redirect(`/login?next=${encodeURIComponent(dest)}`);
  }

  const trip = await prisma.userTrip.findUnique({
    where: { id },
    select: { shareToken: true },
  });
  if (!trip || !trip.shareToken || trip.shareToken !== token) notFound();

  await joinTripViaToken(id, token);
}
