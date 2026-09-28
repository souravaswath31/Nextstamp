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
  if (m.includes("invalid") && m.includes("email")) {
    return "That doesn't look like a valid email address — check it and try again.";
  }
  if (m.includes("signups not allowed") || m.includes("signup is disabled")) {
    return "New sign-ups are closed at the moment.";
  }
  if (m.includes("fetch") || m.includes("network")) {
    return "We couldn't reach the server. Check your connection and try again.";
  }
  // Anything unrecognised: show it, but framed so it doesn't read as the
  // user's fault. Swallowing it entirely would make real faults undebuggable.
  return `We couldn't send the link. ${message}`;
}
