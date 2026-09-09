import type { TripStatus } from "@/lib/types";

const LABEL: Record<TripStatus, string> = {
  idea: "Idea",
  planning: "Planning",
  booked: "Booked",
  completed: "Completed",
};

const STATUS_CLASSES: Record<TripStatus, string> = {
  idea: "bg-charcoal/5 text-ink/60 border-line",
  planning: "bg-teal/10 text-teal border-teal",
  booked: "bg-coral/10 text-coralDark border-coral",
  completed: "bg-forest/10 text-forest border-forest",
};

export default function StatusPill({ status }: { status: TripStatus }) {
  return (
    <span
      className={`inline-block rounded-full border px-2.5 py-0.5 font-stamp text-[11px] font-semibold uppercase tracking-wide ${STATUS_CLASSES[status]}`}
    >
      {LABEL[status]}
    </span>
  );
}
