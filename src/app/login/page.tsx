"use client";

import { useState, type FormEvent } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { Mail, Send, CheckCircle2 } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { friendlyAuthError } from "@/lib/authErrors";

// Google's four-colour mark. Inline rather than an <img> so it can't be the
// thing that fails to load on the one screen that has to work; drawn to
// Google's published proportions for the "Continue with Google" button.
function GoogleMark() {
  return (
    <svg width="17" height="17" viewBox="0 0 48 48" aria-hidden focusable="false">
      <path
        fill="#4285F4"
        d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"
      />
      <path
        fill="#34A853"
        d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"
      />
      <path
        fill="#FBBC05"
        d="M11.69 28.18C11.25 26.86 11 25.45 11 24s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24s.85 6.91 2.34 9.88l7.35-5.7z"
      />
      <path
        fill="#EA4335"
        d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z"
      />
    </svg>
  );
}

export default function LoginPage() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next");
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  // A failure bounced back from the callback route (declined Google consent,
  // an already-used magic link) arrives as a query param.
  const [error, setError] = useState<string | null>(
    searchParams.get("error") ? friendlyAuthError(searchParams.get("error")!) : null
  );
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  // Preserve where the user was headed (e.g. a trip invite link) through
  // whichever sign-in round trip they take — the callback route reads this
  // same `next` param and redirects there instead of the homepage.
  function buildCallbackUrl() {
    const callbackUrl = new URL("/auth/callback", window.location.origin);
    if (next) callbackUrl.searchParams.set("next", next);
    return callbackUrl.toString();
  }

  // Google sign-in exists because magic link alone is a single point of
  // failure: Supabase's built-in mailer sends 2 messages an hour per project,
  // so email problems lock *everyone* out at once. This path sends no email
  // and isn't rate limited. See CLAUDE.md, "Sign-in email is rate limited".
  async function handleGoogle() {
    setError(null);
    setGoogleLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: buildCallbackUrl() },
    });
    // On success the browser navigates away, so only a failure lands here.
    if (error) {
      setGoogleLoading(false);
      setError(friendlyAuthError(error.message));
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const callbackUrl = new URL(buildCallbackUrl());

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: callbackUrl.toString() },
    });

    setLoading(false);
    if (error) setError(friendlyAuthError(error.message));
    else setSent(true);
  }

  return (
    <div
      className="-mx-5 flex min-h-[80vh] items-center justify-center rounded-hero bg-cover bg-center px-4 sm:-mx-8"
      style={{ backgroundImage: "url('/hero-bg.jpg')" }}
    >
      <div className="w-full max-w-sm space-y-8 rounded-hero bg-paper p-9 shadow-paper-lg">
        <div className="text-center">
          <Image src="/icon-badge.png" alt="" width={56} height={56} className="mx-auto h-14 w-14" />
          <h1 className="mt-4 font-display text-3xl tracking-tightest text-ink">
            Next<span className="text-coral">Stamp</span>
          </h1>
          <p className="mt-2 font-body text-sm text-ink/55">
            No password to remember — use Google, or we&apos;ll email you a link.
          </p>
        </div>

        {sent ? (
          <p className="flex items-start gap-2.5 rounded-panel bg-forest/5 px-4 py-3.5 font-body text-sm text-ink/70">
            <CheckCircle2 size={17} className="mt-0.5 shrink-0 text-forest" />
            Check <span className="font-medium text-ink">{email}</span> for a sign-in link.
          </p>
        ) : (
          <div className="space-y-4">
            {/* Google first: it's the path that can't be rate limited, and for
                a travel product it's what most people would reach for anyway. */}
            <button
              type="button"
              onClick={handleGoogle}
              disabled={googleLoading || loading}
              className="flex w-full items-center justify-center gap-2.5 rounded-full border border-line bg-paper py-2.5 font-body text-sm font-medium text-ink shadow-paper transition-colors hover:bg-paperDark disabled:opacity-50"
            >
              <GoogleMark />
              {googleLoading ? "Redirecting…" : "Continue with Google"}
            </button>

            <div className="flex items-center gap-3" aria-hidden>
              <span className="h-px flex-1 bg-line" />
              <span className="font-stamp text-[11px] uppercase tracking-wide text-ink/35">or</span>
              <span className="h-px flex-1 bg-line" />
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
            <div className="relative">
              <Mail size={15} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink/40" />
              <input
                type="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-full bg-paperDark py-2.5 pl-10 pr-4 font-body text-sm text-ink placeholder:text-ink/40 focus:outline-none focus:ring-2 focus:ring-ink/10"
              />
            </div>
              <button
                type="submit"
                disabled={loading || googleLoading}
                className="btn-pill btn-pill-primary w-full disabled:opacity-50"
              >
                <Send size={15} /> {loading ? "Sending…" : "Send magic link"}
              </button>
            </form>

            {error && (
              <p className="rounded-card bg-stampRed/5 px-3.5 py-2.5 font-body text-xs text-stampRed">
                {error}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
