// Which links we will even try to read, and how. Pure, so it is testable.
//
// We only ever talk to a fixed set of hosts. A user-supplied URL is never
// fetched blindly: it must be https, on an allowlisted host, and every
// redirect hop is re-checked against the same list (see source.ts). That is
// what stops this feature being used to make the server fetch internal
// addresses.

export type Platform = "youtube" | "tiktok" | "instagram";

const HOSTS: Record<string, Platform> = {
  "youtube.com": "youtube",
  "www.youtube.com": "youtube",
  "m.youtube.com": "youtube",
  "youtu.be": "youtube",
  "tiktok.com": "tiktok",
  "www.tiktok.com": "tiktok",
  "m.tiktok.com": "tiktok",
  "vm.tiktok.com": "tiktok",
  "vt.tiktok.com": "tiktok",
  "instagram.com": "instagram",
  "www.instagram.com": "instagram",
};

export type ParsedSourceUrl =
  | { ok: true; url: URL; platform: Platform }
  | { ok: false; reason: string };

export function parseSourceUrl(raw: string): ParsedSourceUrl {
  const text = raw.trim();
  if (!text) return { ok: false, reason: "Paste a link first." };
  if (text.length > 600) return { ok: false, reason: "That link is too long to be a post link." };
  let url: URL;
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(text) ? text : `https://${text}`);
  } catch {
    return { ok: false, reason: "That doesn't look like a link." };
  }
  if (url.protocol !== "https:") return { ok: false, reason: "Only https links are supported." };
  if (url.username || url.password || url.port) {
    return { ok: false, reason: "That link has parts we don't accept." };
  }
  const platform = HOSTS[url.hostname.toLowerCase()];
  if (!platform) {
    return {
      ok: false,
      reason: "We read public YouTube, TikTok and Instagram links. For anything else, paste the caption instead.",
    };
  }
  return { ok: true, url, platform };
}

/** Same host check for a redirect target; returns null when it is off the list. */
export function allowedRedirectTarget(from: URL, location: string): URL | null {
  let next: URL;
  try {
    next = new URL(location, from);
  } catch {
    return null;
  }
  if (next.protocol !== "https:" || next.username || next.password || next.port) return null;
  return HOSTS[next.hostname.toLowerCase()] ? next : null;
}

const OEMBED: Partial<Record<Platform, string>> = {
  youtube: "https://www.youtube.com/oembed",
  tiktok: "https://www.tiktok.com/oembed",
};

/** The platform's own oEmbed endpoint for a link, or null if it has no public one. */
export function oembedEndpoint(platform: Platform, postUrl: URL): string | null {
  const base = OEMBED[platform];
  if (!base) return null;
  return `${base}?format=json&url=${encodeURIComponent(postUrl.toString())}`;
}
