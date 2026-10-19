"use client";

import { useState, type FormEvent } from "react";

type Props = { passport: string; destination: string; heldDocument?: string | null; tone?: "app" | "marketing" };

// "This looks wrong". It does not change anything on the page: a person checks the official source and,
// if the rule is wrong, fixes the data and says so in the change log.
export default function ReportRuleError({ passport, destination, heldDocument, tone = "app" }: Props) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [contact, setContact] = useState("");
  const [website, setWebsite] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState("");
  const muted = tone === "marketing" ? "text-white/60 hover:text-coral" : "text-ink/60 hover:text-ink";
  const field = tone === "marketing" ? "bg-white/[0.06] text-white placeholder:text-white/55" : "bg-paperDark text-ink placeholder:text-ink/55";
  const id = `report-${passport}-${destination}-${heldDocument ?? "base"}`.replace(/[^a-z0-9-]/gi, "");

  async function send(e: FormEvent) {
    e.preventDefault();
    setState("sending");
    try {
      const res = await fetch("/api/report-rule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passport, destination, heldDocument, message, contact, website }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Could not send that. Try again.");
        setState("error");
        return;
      }
      setState("sent");
    } catch {
      setError("Could not send that. Check your connection and try again.");
      setState("error");
    }
  }

  if (state === "sent") {
    return <p role="status" className={`font-body text-xs ${muted}`}>Thanks. We'll check it against the official source. A report alone doesn't change a rule.</p>;
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={`font-body text-xs underline underline-offset-2 ${muted}`}>
        Report an error
      </button>
    );
  }

  return (
    <form onSubmit={send} className="mt-2 space-y-2">
      <label htmlFor={`${id}-msg`} className={`block font-body text-xs ${muted}`}>
        What looks wrong about {passport} to {destination}? A link to the official page helps.
      </label>
      <textarea
        id={`${id}-msg`}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        maxLength={600}
        rows={3}
        required
        className={`w-full rounded-card px-3 py-2 font-body text-sm focus:outline-none focus:ring-2 focus:ring-coral/40 ${field}`}
      />
      <label htmlFor={`${id}-contact`} className={`block font-body text-xs ${muted}`}>Email (optional, only if you want a reply)</label>
      <input
        id={`${id}-contact`}
        type="email"
        value={contact}
        onChange={(e) => setContact(e.target.value)}
        maxLength={120}
        autoComplete="email"
        className={`w-full rounded-card px-3 py-2 font-body text-sm focus:outline-none focus:ring-2 focus:ring-coral/40 ${field}`}
      />
      {/* Honeypot: hidden from people, filled by bots. */}
      <input tabIndex={-1} aria-hidden="true" autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} className="hidden" name="website" />
      {state === "error" && <p role="alert" className="font-body text-xs text-stampRed">{error}</p>}
      <div className="flex gap-3">
        <button type="submit" disabled={state === "sending"} className="btn-pill btn-pill-primary !px-4 !py-1.5 !text-xs disabled:opacity-50">
          {state === "sending" ? "Sending…" : "Send report"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className={`font-body text-xs ${muted}`}>Cancel</button>
      </div>
    </form>
  );
}
