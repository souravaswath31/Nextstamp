// Only same-site paths may be used as a post-sign-in destination. Anything else
// (a full URL, "//host", "/\host", "@host" tricks) falls back to "/" so the sign-in
// callback can never be turned into an open redirect.
export function safeNext(raw: string | null | undefined): string {
  if (!raw || !raw.startsWith("/")) return "/";
  if (raw.startsWith("//") || raw.includes("\\")) return "/";
  if (/[\u0000-\u001f]/.test(raw)) return "/";
  const firstSegment = raw.slice(1).split(/[/?#]/)[0];
  if (firstSegment.includes("@") || firstSegment.includes(":")) return "/";
  return raw;
}
