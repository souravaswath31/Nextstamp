// Free-text country fields (held documents, passport country) feed directly
// into exact-string visa-rule matching. Without normalization, a user typing
// "usa" or "United States" instead of "USA" would silently get no cascade
// match at all — the core differentiating feature would just look broken,
// with no error to explain why. This is the one normalization layer that
// keeps stored data matching the canonical names used in the seed data.

const ALIASES: Record<string, string> = {
  "usa": "USA",
  "us": "USA",
  "u.s.": "USA",
  "u.s.a.": "USA",
  "united states": "USA",
  "united states of america": "USA",
  "uae": "UAE",
  "u.a.e.": "UAE",
  "united arab emirates": "UAE",
  "uk": "UK",
  "u.k.": "UK",
  "united kingdom": "UK",
};

export function normalizeCountryInput(raw: string): string {
  const trimmed = raw.trim().replace(/\s+/g, " ");
  if (!trimmed) return trimmed;

  const lower = trimmed.toLowerCase();
  if (ALIASES[lower]) return ALIASES[lower];

  // Otherwise, title-case it so "india" / "INDIA" / "India" all converge on
  // the same stored value and match seed data like "India", "Colombia".
  return trimmed
    .split(" ")
    .map((word) => (word.length > 0 ? word[0].toUpperCase() + word.slice(1).toLowerCase() : word))
    .join(" ");
}
