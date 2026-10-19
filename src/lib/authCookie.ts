// Supabase keeps the session in cookies named like "sb-<project>-auth-token" (split into ".0", ".1"
// when large). No such cookie means there is no session to refresh or look up, so a visitor who has
// never signed in costs no round trip to Supabase Auth: that is every crawler and most first visits.
export function hasAuthCookie(cookieNames: string[]): boolean {
  return cookieNames.some((n) => n.startsWith("sb-") && n.includes("-auth-token"));
}
