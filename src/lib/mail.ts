// Outbound email through Resend's HTTP API. Ships dark: with no RESEND_API_KEY or MAIL_FROM nothing is
// sent and callers keep their old "we don't send email yet" wording. Sign-in emails are separate:
// those go through Supabase, which needs its own SMTP settings in the Supabase dashboard.
export function mailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.MAIL_FROM);
}

export async function sendMail(to: string, subject: string, text: string): Promise<boolean> {
  if (!mailConfigured()) return false;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: process.env.MAIL_FROM, to, subject, text }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) console.error("[mail] send failed", res.status);
    return res.ok;
  } catch (err) {
    console.error("[mail] send failed", err instanceof Error ? err.message : err);
    return false;
  }
}
