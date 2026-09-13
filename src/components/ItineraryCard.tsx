import Link from "next/link";
import { Mountain, Building2, Waves, Gem, Wallet, Route, Compass, type LucideIcon } from "lucide-react";
import { CATEGORY_LABELS, CATEGORY_COLOR_CLASSES } from "@/lib/types";

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

const TILE_CLASSES: Record<string, string> = {
  nature: "bg-catNature/10 text-catNature",
  city: "bg-catCity/10 text-catCity",
  water: "bg-catWater/10 text-catWater",
  splurge: "bg-catSplurge/10 text-catSplurge",
  budget: "bg-catBudget/10 text-catBudget",
  "road-trip": "bg-catRoadTrip/10 text-catRoadTrip",
  "off-the-beaten-path": "bg-catBeaten/10 text-catBeaten",
};

export default function ItineraryCard(props: Props) {
  const cats = props.category.split(",").filter(Boolean);
  const duration =
    props.durationDaysMin === props.durationDaysMax
      ? `${props.durationDaysMin} days`
      : `${props.durationDaysMin}–${props.durationDaysMax} days`;

  const HeadlineIcon = CATEGORY_ICONS[cats[0]] ?? Compass;
  const tileClass = TILE_CLASSES[cats[0]] ?? "bg-ink/5 text-ink/50";

  return (
    <Link
      href={`/itinerary/${props.id}`}
      className="card-lift group block rounded-panel bg-paper p-5 shadow-paper"
    >
      <div className="flex items-start justify-between gap-3">
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${tileClass}`}>
          <HeadlineIcon size={20} />
        </span>
        <span className="mt-1 whitespace-nowrap font-stamp text-xs text-ink/45">
          {duration}
        </span>
      </div>
      <h3 className="mt-3.5 font-display text-lg leading-snug text-ink">
        {props.title}
      </h3>
      <p className="mt-1 font-body text-sm text-ink/55">
        {props.region} · {props.countries.split(",").join(", ")}
      </p>
      <div className="mt-3.5 flex flex-wrap items-center gap-2">
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
      <p className="mt-3 font-body text-xs text-ink/40">
        Best: {props.bestTimeMonths.split(",").join(", ")}
      </p>
    </Link>
  );
}

