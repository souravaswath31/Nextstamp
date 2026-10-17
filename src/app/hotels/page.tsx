import type { Metadata } from "next";
import BookingLinks from "@/components/BookingLinks";
import LinkSearch from "@/components/site/LinkSearch";
import { PageHeader } from "@/components/site/MarketingBits";
import { parseDateParam, stayLinks } from "@/lib/bookingLinks";

export const metadata: Metadata = {
  title: "Hotels — NextStamp",
  description: "Hotel searches prefilled with your destination and dates, on outside suppliers. NextStamp doesn't take bookings.",
};
export const dynamic = "force-dynamic";

const str = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim().slice(0, 80) ?? "";

export default function HotelsPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const values = { to: str(searchParams.to), start: str(searchParams.start), end: str(searchParams.end) };
  const links = stayLinks({ destination: values.to, start: parseDateParam(values.start), end: parseDateParam(values.end) });
  return (
    <>
      <PageHeader
        eyebrow="Hotels"
        title="Somewhere to stay, on the route you planned."
        lead="Enter where and when and we'll hand the search to outside suppliers with it already filled in, so you don't re-enter the dates and the place on each site. We don't show room prices."
      />
      <LinkSearch
        idPrefix="ho"
        button="Find hotel searches"
        values={values}
        fields={[
          { name: "to", label: "Where", placeholder: "Kyoto", required: true },
          { name: "start", label: "Check in", type: "date" },
          { name: "end", label: "Check out", type: "date" },
        ]}
      >
        {links.length > 0 && <BookingLinks stays={links} />}
      </LinkSearch>
    </>
  );
}
