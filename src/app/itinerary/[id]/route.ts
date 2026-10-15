import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Old /itinerary/<cuid> links (shared, bookmarked, indexed) keep working: this
// answers with a permanent 301 to the slug URL. A route handler rather than a
// redirect() in a page, because redirect() in a page sends 307/308 and the
// move is meant to be signalled to crawlers as a permanent 301.
export async function GET(request: Request, { params }: { params: { id: string } }) {
  const itinerary = await prisma.itinerary.findUnique({
    where: { id: params.id },
    select: { slug: true },
  });
  if (!itinerary) return new NextResponse("Not found", { status: 404 });
  return NextResponse.redirect(new URL(`/itineraries/${itinerary.slug}`, request.url), 301);
}
