import { ExternalLink, Hotel, Plane, Ticket } from "lucide-react";
import {
  AFFILIATE_DISCLOSURE,
  NO_AFFILIATE_NOTE,
  anyAffiliate,
  type ActivityGroup,
  type SupplierLink,
} from "@/lib/bookingLinks";

const ICON = { flights: Plane, stays: Hotel, activities: Ticket } as const;

function LinkCard({ link }: { link: SupplierLink }) {
  const Icon = ICON[link.category];
  return (
    <a
      href={link.url}
      target="_blank"
      // "sponsored" is the standard marker for paid or affiliate links.
      rel={link.affiliate ? "sponsored noopener noreferrer" : "noopener noreferrer"}
      className="group block rounded-card bg-paperDark px-4 py-3 transition-colors hover:bg-ink/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-coral"
    >
      <p className="flex flex-wrap items-center gap-1.5 font-body text-sm font-semibold text-ink">
        <Icon size={13} className="text-ink/55" aria-hidden="true" /> {link.provider}
        <ExternalLink size={11} className="text-ink/55" aria-hidden="true" />
        <span className="rounded-full bg-ink/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-ink/60">
          {link.affiliate ? "Affiliate link" : "Outside supplier"}
        </span>
      </p>
      <p className="mt-0.5 max-w-[18rem] font-body text-xs text-ink/55">{link.note}</p>
    </a>
  );
}

function Row({ heading, links }: { heading?: string; links: SupplierLink[] }) {
  if (links.length === 0) return null;
  return (
    <div>
      {heading && <h3 className="mb-2 font-body text-xs font-semibold uppercase tracking-wider text-ink/55">{heading}</h3>}
      <div className="flex flex-wrap gap-2.5">
        {links.map((l) => (
          <LinkCard key={l.id} link={l} />
        ))}
      </div>
    </div>
  );
}

/**
 * Links out to outside suppliers. Every card says it is an outside supplier; a
 * card says "Affiliate link" only when a tag was actually appended, and the
 * commission disclosure only appears when at least one is.
 */
export default function BookingLinks({
  flights = [],
  stays = [],
  activities = [],
}: {
  flights?: SupplierLink[];
  stays?: SupplierLink[];
  activities?: ActivityGroup[];
}) {
  const all = [...flights, ...stays, ...activities.flatMap((g) => g.links)];
  if (all.length === 0) return null;
  return (
    <div className="space-y-5">
      <Row heading={stays.length || activities.length ? "Flights" : undefined} links={flights} />
      <Row heading="Places to stay" links={stays} />
      {activities.map((g) => (
        <Row key={g.label} heading={`Tours and tickets: ${g.label}`} links={g.links} />
      ))}
      <div className="space-y-1 font-body text-xs text-ink/55">
        <p>
          These are links to outside suppliers. NextStamp doesn&apos;t sell flights, rooms or tickets, take
          payment, hold your money or issue a booking. You book, and pay, with the supplier.
        </p>
        <p>{anyAffiliate(all) ? AFFILIATE_DISCLOSURE : NO_AFFILIATE_NOTE}</p>
      </div>
    </div>
  );
}
