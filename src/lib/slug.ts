/**
 * URL slugs for public pages.
 *
 * Derived from the title so the URL says what the page is, and made unique with
 * a numeric suffix because two itineraries can share a title ("Tokyo & Kyoto")
 * and two pages must never fight over one URL. Assignment order is the caller's
 * order, so a reseed that feeds titles in the same order yields the same slugs.
 */
export function slugify(title: string): string {
  return title
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip accents: "Zürich" -> "Zurich"
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['’]/g, "") // "Hawai'i" -> "hawaii", not "hawai-i"
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
}

export function assignUniqueSlugs(titles: string[]): string[] {
  const taken = new Set<string>();
  return titles.map((title) => {
    const base = slugify(title) || "itinerary";
    let slug = base;
    for (let n = 2; taken.has(slug); n++) slug = `${base}-${n}`;
    taken.add(slug);
    return slug;
  });
}
