import Link from "next/link";
import { CATEGORY_LABELS, CATEGORY_COLOR_CLASSES, CATEGORY_BORDER_CLASSES } from "@/lib/types";

type Props = {
  id: string;
  title: string;
  region: string;
  countries: string;
  category: string;
  durationDaysMin: number;
  durationDaysMax: number;
  costTier: string;
  bestTimeMonths: string;
};

export default function ItineraryCard(props: Props) {
  const cats = props.category.split(",").filter(Boolean);
  const topBorderClass = CATEGORY_BORDER_CLASSES[cats[0]] ?? "border-t-ink";
  const duration =
    props.durationDaysMin === props.durationDaysMax
      ? `${props.durationDaysMin} days`
      : `${props.durationDaysMin}–${props.durationDaysMax} days`;

  return (
    <Link
      href={`/itinerary/${props.id}`}
      className={`group block border border-line border-t-[3px] bg-paper px-5 py-4 transition-colors hover:border-ink ${topBorderClass}`}
    >
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-display text-lg leading-snug text-ink group-hover:underline">
          {props.title}
        </h3>
        <span className="whitespace-nowrap font-stamp text-xs text-ink/60">
          {duration}
        </span>
      </div>
      <p className="mt-1 font-body text-sm text-ink/70">
        {props.region} · {props.countries.split(",").join(", ")}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {cats.map((c) => (
          <span
            key={c}
            className={`rounded-full px-2.5 py-0.5 font-body text-[11px] font-medium ${CATEGORY_COLOR_CLASSES[c] ?? "bg-line/40 text-ink/70"}`}
          >
            {CATEGORY_LABELS[c] ?? c}
          </span>
        ))}
        <span className="ml-auto rounded-full bg-coral/10 px-2.5 py-0.5 font-stamp text-[11px] uppercase text-coralDark">
          {props.costTier}
        </span>
      </div>
      <p className="mt-2 font-body text-xs text-ink/50">
        Best: {props.bestTimeMonths.split(",").join(", ")}
      </p>
    </Link>
  );
}

