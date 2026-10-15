import { VISA_TYPE_LABEL, type PublicRule } from "@/lib/passportCheck";

// Colour carries the answer, never alone: the label is always printed beside it.
export const VISA_TONE: Record<PublicRule["visaType"], { dot: string; text: string; ring: string }> = {
  "visa-free": { dot: "bg-forest", text: "text-[#6FD58B]", ring: "border-forest/50" },
  "visa-on-arrival": { dot: "bg-teal", text: "text-[#5FD8EE]", ring: "border-teal/50" },
  "e-visa": { dot: "bg-stamp", text: "text-[#F7C265]", ring: "border-stamp/50" },
  "advance-visa-required": { dot: "bg-stampRed", text: "text-[#FF8A93]", ring: "border-stampRed/55" },
};

export default function VisaStamp({ type, className = "" }: { type: PublicRule["visaType"]; className?: string }) {
  const tone = VISA_TONE[type];
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 font-body text-xs font-semibold ${tone.ring} ${tone.text} ${className}`}
    >
      <span className={`h-2 w-2 rounded-full ${tone.dot}`} aria-hidden="true" />
      {VISA_TYPE_LABEL[type]}
    </span>
  );
}
