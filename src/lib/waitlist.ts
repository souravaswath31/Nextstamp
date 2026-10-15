export const WAITLIST_INTERESTS = ["flights", "hotels", "activities", "passport", "wallet", "trip-link", "paid"] as const;
export type WaitlistInterest = (typeof WAITLIST_INTERESTS)[number];

export type WaitlistInput = {
  email: string;
  interest: string;
  requestedPassport?: string | null;
  /** Honeypot: a real visitor never sees this field, so it must arrive empty. */
  website?: string | null;
};

export type WaitlistValidation =
  | { ok: true; email: string; interest: WaitlistInterest; requestedPassport: string | null }
  | { ok: false; error: string; /** true = a bot tripped the honeypot; answer as if it worked. */ silent?: boolean };

// Deliberately modest: one @, something on each side, a dot in the domain, no
// spaces. Real validation is the confirmation email we are not sending yet.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function validateWaitlist(input: WaitlistInput): WaitlistValidation {
  if (input.website && input.website.trim() !== "") {
    return { ok: false, error: "", silent: true };
  }
  const email = (input.email ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return { ok: false, error: "That doesn't look like an email address." };
  }
  const interest = (input.interest ?? "").trim().toLowerCase();
  if (!(WAITLIST_INTERESTS as readonly string[]).includes(interest)) {
    return { ok: false, error: "Pick what you want to hear about." };
  }
  const passport = (input.requestedPassport ?? "").trim().replace(/\s+/g, " ");
  if (passport.length > 60) return { ok: false, error: "That passport name is too long." };
  return {
    ok: true,
    email,
    interest: interest as WaitlistInterest,
    requestedPassport: passport || null,
  };
}

/**
 * Fixed-window in-memory limiter. Honest limits: serverless instances don't
 * share memory, so this slows a script hammering one instance and stops
 * nothing determined. The unique (email, interest) key and the honeypot do the
 * rest; a real limiter wants a shared store, which is not worth a new service
 * for a waitlist.
 */
export function makeRateLimiter(max: number, windowMs: number) {
  const hits = new Map<string, { count: number; resetAt: number }>();
  return function allow(key: string, now: number = Date.now()): boolean {
    const entry = hits.get(key);
    if (!entry || now >= entry.resetAt) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
      if (hits.size > 5000) for (const [k, v] of hits) if (now >= v.resetAt) hits.delete(k);
      return true;
    }
    entry.count += 1;
    return entry.count <= max;
  };
}
