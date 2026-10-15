"use client";

import { useFormState, useFormStatus } from "react-dom";
import { joinWaitlist, type WaitlistState } from "@/lib/waitlistActions";
import type { WaitlistInterest } from "@/lib/waitlist";

const INITIAL: WaitlistState = { status: "idle", message: "" };

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="btn-pill btn-pill-accent !py-3 whitespace-nowrap disabled:opacity-60"
    >
      {pending ? "Adding…" : label}
    </button>
  );
}

/**
 * Waitlist signup. No email is sent yet — the confirmation message says so —
 * and the hidden `website` field is the honeypot: invisible to people, filled
 * by form-stuffing bots, ignored (silently) by the server action.
 */
export default function WaitlistForm({
  interest,
  requestedPassport,
  label = "Join the waitlist",
  inputId,
}: {
  interest: WaitlistInterest;
  requestedPassport?: string;
  label?: string;
  inputId: string;
}) {
  const [state, action] = useFormState(joinWaitlist, INITIAL);

  if (state.status === "ok") {
    return (
      <p role="status" className="rounded-card bg-forest/15 px-4 py-3 font-body text-sm text-bone">
        {state.message}
      </p>
    );
  }

  return (
    <form action={action} className="space-y-2" noValidate>
      <input type="hidden" name="interest" value={interest} />
      {requestedPassport ? <input type="hidden" name="requestedPassport" value={requestedPassport} /> : null}
      {/* Honeypot. Off-screen rather than display:none, which some bots skip. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label htmlFor={`${inputId}-website`}>Leave this empty</label>
        <input id={`${inputId}-website`} name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <label htmlFor={inputId} className="sr-only">
          Email address
        </label>
        <input
          id={inputId}
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          className="min-w-0 flex-1 rounded-full border border-white/15 bg-white/[0.06] px-5 py-3 font-body text-sm text-white placeholder:text-white/35 focus:border-coral focus:outline-none focus-visible:ring-2 focus-visible:ring-coral/50"
        />
        <Submit label={label} />
      </div>
      {state.status === "error" && (
        <p role="alert" className="font-body text-sm text-coral">
          {state.message}
        </p>
      )}
    </form>
  );
}
