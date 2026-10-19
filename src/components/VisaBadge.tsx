import { AlertTriangle } from "lucide-react";
import TrustNotes from "./TrustNotes";
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
            {status.viaDocumentCountry ? `via your ${status.viaDocumentCountry} visa or permit` : "via a document you hold"}
          </span>
        )}
      </div>
      {status.needsVerification && !status.sourceUrl ? (
        <span className="flex items-center gap-1.5 font-body text-xs text-stampRed">
          <AlertTriangle size={13} /> Verify before booking — no confirmed source on file
        </span>
      ) : (
        <TrustNotes
          conditions={status.conditionsText ?? ""}
          sourceUrl={status.sourceUrl ?? null}
          verified={status.lastVerifiedDate ?? null}
          passport={status.passportCountry ?? ""}
          destination={status.destinationCountry}
          heldDocument={status.viaDocumentCountry}
        />
      )}
    </div>
  );
}
