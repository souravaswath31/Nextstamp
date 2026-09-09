// A raw AI chat tool can tell you a document's visa cascade value in the
// moment you ask, but it can't watch that document over time and warn you,
// unprompted, that it's about to expire — and take your cascade access
// with it. That requires state that outlives a single conversation, which
// is exactly what NextStamp already has (HeldDocument.validUntil) and
// simply wasn't using. This is the whole feature: compute urgency from a
// date, nothing more exotic than that.

export type ExpirySeverity = "expired" | "critical" | "warning" | "ok" | "none";

export type ExpiryStatus = {
  severity: ExpirySeverity;
  daysLeft: number | null;
  label: string;
};

const CRITICAL_THRESHOLD_DAYS = 30;
const WARNING_THRESHOLD_DAYS = 90;

export function getExpiryStatus(validUntil: Date | string | null, asOf: Date = new Date()): ExpiryStatus {
  if (!validUntil) {
    return { severity: "none", daysLeft: null, label: "No expiration on file" };
  }

  const expiry = new Date(validUntil);
  const msPerDay = 1000 * 60 * 60 * 24;
  const daysLeft = Math.ceil((expiry.getTime() - asOf.getTime()) / msPerDay);

  if (daysLeft < 0) {
    return { severity: "expired", daysLeft, label: `Expired ${Math.abs(daysLeft)} day${Math.abs(daysLeft) === 1 ? "" : "s"} ago` };
  }
  if (daysLeft <= CRITICAL_THRESHOLD_DAYS) {
    return { severity: "critical", daysLeft, label: daysLeft === 0 ? "Expires today" : `Expires in ${daysLeft} day${daysLeft === 1 ? "" : "s"}` };
  }
  if (daysLeft <= WARNING_THRESHOLD_DAYS) {
    return { severity: "warning", daysLeft, label: `Expires in ${daysLeft} days` };
  }
  return { severity: "ok", daysLeft, label: `Valid until ${expiry.toLocaleDateString()}` };
}

export const EXPIRY_SEVERITY_CLASSES: Record<ExpirySeverity, string> = {
  expired: "border-l-stampRed bg-stampRed/5 text-stampRed",
  critical: "border-l-stampRed bg-stampRed/5 text-stampRed",
  warning: "border-l-stamp bg-stamp/5 text-ink",
  ok: "border-l-line text-ink/50",
  none: "border-l-line text-ink/40",
};

// Only documents actually worth surfacing on the dashboard — expired ones
// too (a lapsed document silently breaking cascade access is worse than
// one merely approaching it).
export function isUrgent(status: ExpiryStatus): boolean {
  return status.severity === "expired" || status.severity === "critical" || status.severity === "warning";
}
