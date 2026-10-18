/**
 * Supabase sends the browser to its configured Site URL (not to the page that started sign-in)
 * whenever the requested redirect is not on the project's allow-list. That lands the one-time
 * `?code=` on "/", which nothing handles, so the person sees a broken page instead of being
 * signed in. The PKCE verifier cookie lives on the origin that began sign-in, which is the origin
 * serving this request, so forwarding the same query to /auth/callback completes the exchange.
 * Returns the path-and-query to redirect to, or null when the request is not such a landing.
 */
export function authCodeLandingRedirect(pathname: string, search: string): string | null {
  if (pathname !== "/") return null;
  const params = new URLSearchParams(search);
  const code = params.get("code");
  // Supabase auth codes are UUIDs; anything else on "/" is not ours to forward.
  if (!code || !/^[0-9a-f-]{20,}$/i.test(code)) return null;
  return `/auth/callback?${params.toString()}`;
}
