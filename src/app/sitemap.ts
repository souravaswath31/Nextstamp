import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";

const BASE_URL = "https://nextstamp-app.vercel.app";

// Only the free browsable library goes in the sitemap — dashboard, profile,
// my-trips, and trip/[id] are personal pages behind a real login and have
// nothing for a crawler (or a logged-out visitor) to index.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [states, itineraries] = await Promise.all([
    prisma.stateGuide.findMany({ select: { slug: true, createdAt: true } }),
    prisma.itinerary.findMany({ select: { id: true, createdAt: true } }),
  ]);

  return [
    { url: BASE_URL, changeFrequency: "weekly", priority: 1 },
    { url: `${BASE_URL}/states`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${BASE_URL}/explore`, changeFrequency: "weekly", priority: 0.9 },
    ...states.map((s) => ({
      url: `${BASE_URL}/state/${s.slug}`,
      lastModified: s.createdAt,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    ...itineraries.map((i) => ({
      url: `${BASE_URL}/itinerary/${i.id}`,
      lastModified: i.createdAt,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
  ];
}
