// Reads the public text of a post: the platform's oEmbed answer first, then
// the page's public <meta> tags. Never logs in, never reads a private account,
// never follows a redirect off the allowlist, and caps what it reads.

import { allowedRedirectTarget, oembedEndpoint, parseSourceUrl, type Platform } from "./sourceUrl";

export type SourceText = {
  platform: Platform;
  /** What we could read, joined; empty when the platform gave us nothing. */
  text: string;
  author: string | null;
};

const MAX_BYTES = 400_000;
const TIMEOUT_MS = 8_000;
const UA = "NextStampBot/1.0 (+https://nextstamp-app.vercel.app/about)";

type FetchLike = typeof fetch;

async function readCapped(res: Response): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (total < MAX_BYTES) {
    const { done, value } = await reader.read();
    if (done || !value) break;
    chunks.push(value);
    total += value.length;
  }
  try { await reader.cancel(); } catch { /* already closed */ }
  return new TextDecoder().decode(Buffer.concat(chunks.map((c) => Buffer.from(c))));
}

async function getAllowed(start: URL, fetchImpl: FetchLike, accept: string): Promise<Response | null> {
  let current = start;
  for (let hop = 0; hop < 4; hop++) {
    const res = await fetchImpl(current.toString(), {
      redirect: "manual",
      headers: { "user-agent": UA, accept, "accept-language": "en" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      const next = loc ? allowedRedirectTarget(current, loc) : null;
      if (!next) return null;
      current = next;
      continue;
    }
    return res.ok ? res : null;
  }
  return null;
}

export function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)));
}

/** Public og:/description meta values from a page's HTML. Pure. */
export function extractMeta(html: string): { title: string | null; description: string | null } {
  const grab = (names: string[]): string | null => {
    for (const name of names) {
      const re = new RegExp(
        `<meta[^>]+(?:property|name)=["']${name}["'][^>]*content=["']([^"']*)["']|<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${name}["']`,
        "i"
      );
      const m = html.match(re);
      const v = m ? m[1] ?? m[2] : null;
      if (v && v.trim()) return decodeEntities(v.trim());
    }
    return null;
  };
  return { title: grab(["og:title", "twitter:title"]), description: grab(["og:description", "description", "twitter:description"]) };
}

export async function readSourceUrl(raw: string, fetchImpl: FetchLike = fetch): Promise<
  { ok: true; source: SourceText } | { ok: false; reason: string }
> {
  const parsed = parseSourceUrl(raw);
  if (!parsed.ok) return parsed;
  const { url, platform } = parsed;
  const parts: string[] = [];
  let author: string | null = null;

  try {
    const endpoint = oembedEndpoint(platform, url);
    if (endpoint) {
      const res = await getAllowedOembed(endpoint, fetchImpl);
      if (res) {
        if (res.title) parts.push(res.title);
        author = res.author_name ?? null;
      }
    }
    const page = await getAllowed(url, fetchImpl, "text/html");
    if (page) {
      const meta = extractMeta(await readCapped(page));
      for (const v of [meta.title, meta.description]) {
        if (v && !parts.some((p) => p.includes(v) || v.includes(p))) parts.push(v);
      }
    }
  } catch {
    // Network trouble and timeouts are the same answer to the user: we couldn't read it.
  }

  const text = parts.join("\n\n").trim();
  if (text.length < 20) {
    return {
      ok: false,
      reason:
        "We couldn't read any text from that link. The post may be private, or the platform may not share it. Paste the caption instead, or upload screenshots.",
    };
  }
  return { ok: true, source: { platform, text, author } };
}

async function getAllowedOembed(
  endpoint: string,
  fetchImpl: FetchLike
): Promise<{ title?: string; author_name?: string } | null> {
  // The endpoint is one of our two fixed oEmbed URLs, so no host check is needed here.
  const res = await fetchImpl(endpoint, {
    redirect: "error",
    headers: { "user-agent": UA, accept: "application/json" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) return null;
  try {
    return JSON.parse(await readCapped(res));
  } catch {
    return null;
  }
}
