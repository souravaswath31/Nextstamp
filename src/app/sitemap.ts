import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";

import { SITE_URL } from "@/lib/siteUrl";
import { getPublicRules } from "@/lib/siteData";
import { cascadeDocuments, cascadeSlug, isIndexablePair, pairSlug, passportsIn } from "@/lib/visaPages";
import { slugify } from "@/lib/slug";

const BASE_URL = SITE_URL;

// Rebuilt at most hourly, so new itineraries and guides reach crawlers without a redeploy.
export const revalidate = 3600;

// Only the free browsable library goes in the sitemap — dashboard, profile,
// my-trips, and trip/[id] are personal pages behind a real login and have
// nothing for a crawler (or a logged-out visitor) to index.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // If the database is unreachable (a build during an outage), serve the fixed pages rather than
  // failing the whole deploy; the next hourly refresh fills in the guides and itineraries.
  const [states, itineraries, countries] = await Promise.all([
    prisma.stateGuide.findMany({ select: { slug: true, createdAt: true } }),
    prisma.itinerary.findMany({ where: { isPublic: true }, select: { slug: true, createdAt: true } }),
    prisma.countryFact.findMany({ select: { country: true, lastVerifiedDate: true } }),
  ]).catch((err) => {
    console.error("[sitemap] database unavailable, serving fixed pages only", err instanceof Error ? err.message : err);
    return [[], [], []] as [{ slug: string; createdAt: Date }[], { slug: string; createdAt: Date }[], { country: string; lastVerifiedDate: Date }[]];
  });

  // Visa pages: hubs, per-passport pages, cascade pages, and only the staged pair pages that qualify for indexing.
  const rules = await getPublicRules().catch(() => []);
  const passports = passportsIn(rules);
  const visaPages: MetadataRoute.Sitemap = [
    { url: `${BASE_URL}/visa`, changeFrequency: "weekly", priority: 0.8 },
    ...passports.map((p) => ({ url: `${BASE_URL}/visa/from/${slugify(p)}`, changeFrequency: "weekly" as const, priority: 0.7 })),
    ...passports.flatMap((p) => cascadeDocuments(rules, p).map((d) => ({ url: `${BASE_URL}/visa/${cascadeSlug(p, d)}`, changeFrequency: "weekly" as const, priority: 0.7 }))),
    ...passports.flatMap((p) =>
      Array.from(new Set(rules.filter((r) => r.passport === p).map((r) => r.destination)))
        .filter((d) => isIndexablePair(rules, p, d))
        .map((d) => ({ url: `${BASE_URL}/visa/${pairSlug(p, d)}`, changeFrequency: "weekly" as const, priority: 0.6 }))
    ),
  ];

  return [
    ...visaPages,
    { url: BASE_URL, changeFrequency: "weekly", priority: 1 },
    { url: `${BASE_URL}/states`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${BASE_URL}/explore`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${BASE_URL}/countries`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${BASE_URL}/features/visa-check`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE_URL}/features/trip-from-a-link`, changeFrequency: "monthly", priority: 0.4 },
    { url: `${BASE_URL}/escape`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE_URL}/pricing`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE_URL}/about`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE_URL}/contact`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE_URL}/flights`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${BASE_URL}/hotels`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${BASE_URL}/activities`, changeFrequency: "yearly", priority: 0.2 },
    // Country guides carry lastVerifiedDate as lastModified rather than a
    // createdAt: for this content the verification date is the meaningful
    // "how current is this" signal, and it's the same date the page shows.
    ...countries.map((c) => ({
      url: `${BASE_URL}/country/${c.country.toLowerCase().replace(/\s+/g, "-")}`,
      lastModified: c.lastVerifiedDate,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
    ...states.map((s) => ({
      url: `${BASE_URL}/state/${s.slug}`,
      lastModified: s.createdAt,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    ...itineraries.map((i) => ({
      url: `${BASE_URL}/itineraries/${i.slug}`,
      lastModified: i.createdAt,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
  ];
}
