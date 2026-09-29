/**
 * Supabase returns terse, developer-facing strings ("email rate limit
 * exceeded") that tell the person at the keyboard nothing about what happened
 * or what to do next. Translate the ones we actually see.
 *
 * The rate-limit case is worth explaining properly rather than hiding: until a
 * custom SMTP provider is configured, Supabase's built-in email service sends
 * **2 messages per hour per project** — a documented cap on a service Supabase
 * says is for testing, not production. Someone hitting it hasn't done anything
 * wrong and retrying won't help, so the copy says so instead of inviting them
 * to mash the button. See CLAUDE.md, "Sign-in email is rate limited".
 *
 * Lives here rather than in the login page because a Next.js page module may
 * only export the framework's own set of names — exporting a helper from one
 * fails the build.
 */
export function friendlyAuthError(message: string): string {
  // Supabase reports the same condition as prose ("email rate limit exceeded")
  // and as an error code ("over_email_send_rate_limit"), so flatten separators
  // before matching rather than listing both spellings of every phrase.
  const m = message.toLowerCase().replace(/[_-]+/g, " ");

  if (m.includes("rate limit") || m.includes("too many requests")) {
    return (
      "We've hit this site's hourly limit for sign-in emails — it's a limit on our end, " +
      "not anything you did, and sending again won't get through. Please try again in an hour."
    );
  }
  // Checked before the malformed-address branch below: Supabase words a stale
  // magic link as "Email link is invalid or has expired", which contains both
  // "invalid" and "email" and would otherwise be reported as a typo in the
  // address the person just typed correctly.
  if (m.includes("expired") || m.includes("already been used")) {
    return "That sign-in link has expired or was already used. Request a fresh one below.";
  }
  if (m.includes("invalid") && m.includes("email") && !m.includes("link")) {
    return "That doesn't look like a valid email address — check it and try again.";
  }
  if (m.includes("signups not allowed") || m.includes("signup is disabled")) {
    return "New sign-ups are closed at the moment.";
  }
  if (m.includes("fetch") || m.includes("network")) {
    return "We couldn't reach the server. Check your connection and try again.";
  }
  // Google (or any OAuth provider) not switched on in Supabase. This is a
  // configuration mistake on our side and the person can't do anything about
  // it, so point them at the route that does work rather than leaving them
  // staring at "unsupported provider".
  if (m.includes("provider is not enabled") || m.includes("unsupported provider")) {
    return "Google sign-in isn't switched on yet. Use the magic link below instead.";
  }
  // The person declined at Google's consent screen — not an error, a choice.
  if (m.includes("access denied") || m.includes("cancelled") || m.includes("canceled")) {
    return "Sign-in was cancelled. Nothing happened — try again whenever you like.";
  }
  // Anything unrecognised: show it, but framed so it doesn't read as the
  // user's fault, and without naming a method — this path is reached from both
  // the email and the Google flows.
  return `We couldn't sign you in. ${message}`;
}
