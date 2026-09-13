import { AlertTriangle, ExternalLink } from "lucide-react";
import type { VisaStatus } from "@/lib/visa";
import { VISA_STATUS_CLASSES } from "@/lib/types";

const STATUS_LABEL: Record<VisaStatus["status"], string> = {
  resident: "Already valid",
  "visa-free": "Visa-free",
  "visa-on-arrival": "Visa on arrival",
  "e-visa": "e-Visa",
  "advance-visa-required": "Advance visa needed",
  unknown: "Not checked yet",
};

function formatVerifiedDate(d?: Date | string | null) {
  if (!d) return null;
  return new Date(d).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export default function VisaBadge({ status }: { status: VisaStatus }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-start gap-3">
        <span
          className={`stamp-mark font-stamp text-xs font-semibold uppercase ${VISA_STATUS_CLASSES[status.status]}`}
        >
          {STATUS_LABEL[status.status]}
        </span>
        {status.viaCascade && (
          <span className="mt-1 rounded-full bg-coral/10 px-2 py-1 font-body text-xs font-medium text-coralDark">
            via your US visa
          </span>
        )}
      </div>
      {status.needsVerification ? (
        <span className="flex items-center gap-1.5 font-body text-xs text-stampRed">
          <AlertTriangle size={13} /> Verify before booking — no confirmed source on file
        </span>
      ) : (
        status.sourceUrl && (
          <a
            href={status.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 font-body text-xs text-forest underline decoration-forest/40 underline-offset-2 hover:decoration-forest"
          >
            Source verified {formatVerifiedDate(status.lastVerifiedDate)} <ExternalLink size={12} />
          </a>
        )
      )}
    </div>
  );
}
