"use client";

import { useState, type FormEvent } from "react";
import { createClient } from "@/utils/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });

    setLoading(false);
    if (error) setError(error.message);
    else setSent(true);
  }

  return (
    <div className="mx-auto max-w-sm space-y-8 py-16">
      <div>
        <p className="font-stamp text-xs uppercase tracking-widest text-ink/50">Sign in</p>
        <h1 className="mt-1 font-display text-3xl text-ink">
          Next<span className="text-coral">Stamp</span>
        </h1>
        <p className="mt-2 font-body text-sm text-ink/60">
          We&apos;ll email you a link — no password to remember.
        </p>
      </div>

      {sent ? (
        <p className="border border-line bg-paperDark px-4 py-3 font-body text-sm text-ink/70">
          Check <span className="font-medium text-ink">{email}</span> for a sign-in link.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="email"
            required
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full border border-line bg-paper px-3 py-2 font-body text-sm text-ink placeholder:text-ink/40"
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full border border-ink px-3 py-2 font-body text-sm text-ink hover:bg-ink hover:text-paper disabled:opacity-50"
          >
            {loading ? "Sending…" : "Send magic link"}
          </button>
          {error && <p className="font-body text-xs text-stampRed">{error}</p>}
        </form>
      )}
    </div>
  );
}
