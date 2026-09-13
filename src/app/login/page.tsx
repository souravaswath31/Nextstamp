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
      <div className="w-full max-w-sm space-y-8 border border-line bg-paper p-8 shadow-paper-lg">
        <div className="text-center">
          <span className="stamp-mark mx-auto flex h-14 w-14 items-center justify-center border-coral text-coral">
            <span className="font-stamp text-xl font-bold not-italic">N</span>
          </span>
          <h1 className="mt-3 font-display text-3xl text-ink">
            Next<span className="text-coral">Stamp</span>
          </h1>
          <p className="mt-2 font-body text-sm text-ink/60">
            We&apos;ll email you a link — no password to remember.
          </p>
        </div>

        {sent ? (
          <p className="flex items-start gap-2.5 border border-forest/30 bg-forest/5 px-4 py-3 font-body text-sm text-ink/70">
            <CheckCircle2 size={17} className="mt-0.5 shrink-0 text-forest" />
            Check <span className="font-medium text-ink">{email}</span> for a sign-in link.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="relative">
              <Mail size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink/40" />
              <input
                type="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full border border-line bg-paper py-2 pl-9 pr-3 font-body text-sm text-ink placeholder:text-ink/40 focus:border-ink focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 border border-ink bg-ink px-3 py-2.5 font-body text-sm font-medium text-paper transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              <Send size={15} /> {loading ? "Sending…" : "Send magic link"}
            </button>
            {error && <p className="font-body text-xs text-stampRed">{error}</p>}
          </form>
        )}
      </div>
    </div>
  );
}
