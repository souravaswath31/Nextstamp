"use client";

import { useState, type FormEvent } from "react";
import { Mail, Send, CheckCircle2 } from "lucide-react";
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
    <div className="flex min-h-[80vh] items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-8 rounded-hero bg-paper p-9 shadow-paper-lg">
        <div className="text-center">
          <span className="stamp-mark mx-auto flex h-14 w-14 items-center justify-center border-coral text-coral">
            <span className="font-stamp text-xl font-bold">N</span>
          </span>
          <h1 className="mt-4 font-display text-3xl tracking-tightest text-ink">
            Next<span className="text-coral">Stamp</span>
          </h1>
          <p className="mt-2 font-body text-sm text-ink/55">
            We&apos;ll email you a link — no password to remember.
          </p>
        </div>

        {sent ? (
          <p className="flex items-start gap-2.5 rounded-panel bg-forest/5 px-4 py-3.5 font-body text-sm text-ink/70">
            <CheckCircle2 size={17} className="mt-0.5 shrink-0 text-forest" />
            Check <span className="font-medium text-ink">{email}</span> for a sign-in link.
          </p>
        ) : (
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
            <button type="submit" disabled={loading} className="btn-pill btn-pill-primary w-full">
              <Send size={15} /> {loading ? "Sending…" : "Send magic link"}
            </button>
            {error && <p className="font-body text-xs text-stampRed">{error}</p>}
          </form>
        )}
      </div>
    </div>
  );
}
