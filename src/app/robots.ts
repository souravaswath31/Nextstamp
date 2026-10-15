import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/siteUrl";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // /t/ holds read-only public trip links. They're public in the sense
      // that anyone with the link can open them, not in the sense that they
      // should turn up in search results for someone's name — the pages also
      // carry robots: noindex in their own metadata.
      disallow: ["/profile", "/my-trips", "/trip/", "/t/", "/onboarding", "/wallet", "/api/"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
