import Link from "next/link";
import { Mountain, Building2, Waves, Gem, Wallet, Route, Compass, type LucideIcon } from "lucide-react";
import { CATEGORY_LABELS, CATEGORY_COLOR_CLASSES, CATEGORY_BORDER_CLASSES } from "@/lib/types";

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  nature: Mountain,
  city: Building2,
  water: Waves,
  splurge: Gem,
  budget: Wallet,
  "road-trip": Route,
  "off-the-beaten-path": Compass,
};

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

  const HeadlineIcon = CATEGORY_ICONS[cats[0]] ?? Compass;

  return (
    <Link
      href={`/itinerary/${props.id}`}
      className={`card-lift group block border border-line border-t-[3px] bg-paper px-5 py-4 hover:border-ink ${topBorderClass}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <HeadlineIcon size={18} className="mt-0.5 shrink-0 text-ink/30" />
          <h3 className="font-display text-lg leading-snug text-ink group-hover:underline">
            {props.title}
          </h3>
        </div>
        <span className="whitespace-nowrap font-stamp text-xs text-ink/60">
          {duration}
        </span>
      </div>
      <p className="mt-1 pl-[26px] font-body text-sm text-ink/70">
        {props.region} · {props.countries.split(",").join(", ")}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2 pl-[26px]">
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
      <p className="mt-2 pl-[26px] font-body text-xs text-ink/50">
        Best: {props.bestTimeMonths.split(",").join(", ")}
      </p>
    </Link>
  );
}

