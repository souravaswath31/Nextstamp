import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";

// Where Supabase sends the user back — from a magic-link email OR from Google
// OAuth. Both use the same PKCE code exchange, so one handler covers both.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  // The provider reports its own failures here as query params — a declined
  // Google consent screen, an expired link. Pass the reason back to /login
  // rather than bouncing the person to a blank form with no explanation of
  // what just went wrong.
  const providerError = searchParams.get("error_description") ?? searchParams.get("error");

  const backToLogin = (reason?: string | null) => {
    const url = new URL("/login", origin);
    if (reason) url.searchParams.set("error", reason);
    if (next && next !== "/") url.searchParams.set("next", next);
    return NextResponse.redirect(url);
  };

  if (providerError) return backToLogin(providerError);
  if (!code) return backToLogin("Sign-in link was missing its code — it may have already been used.");

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return backToLogin(error.message);

  return NextResponse.redirect(`${origin}${next}`);
}
