// Affiliate tagging, kept deliberately dumb.
//
// Each supplier's program hands you its own tracking parameters, and they all
// look different. Rather than guess any program's format here, the whole tag is
// configuration: set e.g. AFFILIATE_BOOKING="aid=123456" or
// AFFILIATE_VIATOR="pid=P00012345&mcid=42383&medium=link" and that exact query
// string is appended to that supplier's search links. Unset means a plain link,
// and the page says so: a link is only ever described as an affiliate link when
// a tag was actually appended to it.
//
// The value is validated strictly (name=value pairs, no spaces or odd
// characters) so a mistyped or hostile env value can't inject anything into a
// URL. An invalid value is ignored whole and the link goes out untagged.

export type SupplierId = "google-flights" | "kayak" | "google-hotels" | "booking" | "getyourguide" | "viator";

const NAME = /^[A-Za-z][A-Za-z0-9_]{0,30}$/;
const VALUE = /^[A-Za-z0-9._~%-]{1,80}$/;

export function parseAffiliateTag(raw: string | undefined | null): [string, string][] | null {
  if (!raw) return null;
  const pairs = raw.trim().replace(/^\?/, "").split("&").filter(Boolean);
  if (pairs.length === 0 || pairs.length > 6) return null;
  const out: [string, string][] = [];
  for (const p of pairs) {
    const eq = p.indexOf("=");
    if (eq < 1) return null;
    const k = p.slice(0, eq);
    const v = p.slice(eq + 1);
    if (!NAME.test(k) || !VALUE.test(v)) return null;
    out.push([k, v]);
  }
  return out;
}

export function envKeyFor(id: SupplierId): string {
  return `AFFILIATE_${id.toUpperCase().replace(/-/g, "_")}`;
}

/** The tag for a supplier from the environment, or null. Server-side only (the vars have no NEXT_PUBLIC_ prefix). */
export function affiliateTagFor(id: SupplierId, env: Record<string, string | undefined> = process.env): [string, string][] | null {
  // Google's products have no affiliate program, so they are never tagged, whatever the env says.
  if (id === "google-flights" || id === "google-hotels") return null;
  return parseAffiliateTag(env[envKeyFor(id)]);
}

/** Appends a validated tag, replacing any same-named parameter the base URL already had. */
export function applyTag(url: string, tag: [string, string][] | null): { url: string; affiliate: boolean } {
  if (!tag) return { url, affiliate: false };
  const u = new URL(url);
  for (const [k, v] of tag) u.searchParams.set(k, decodeURIComponent(v));
  return { url: u.toString(), affiliate: true };
}
