import type { Metadata } from "next";
import BookingLinks from "@/components/BookingLinks";
import LinkSearch from "@/components/site/LinkSearch";
import { PageHeader } from "@/components/site/MarketingBits";
import { flightLinks, parseDateParam } from "@/lib/bookingLinks";

export const metadata: Metadata = {
  title: "Flights — NextStamp",
  description: "Flight searches prefilled with your route and dates, on outside suppliers. NextStamp doesn't sell tickets.",
};
export const dynamic = "force-dynamic";

const str = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim().slice(0, 80) ?? "";

export default function FlightsPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const values = { from: str(searchParams.from), to: str(searchParams.to), start: str(searchParams.start), end: str(searchParams.end) };
  const links = flightLinks({
    origin: values.from,
    destination: values.to,
    start: parseDateParam(values.start),
    end: parseDateParam(values.end),
  });
  return (
    <>
      <PageHeader
        eyebrow="Flights"
        title="Flights, once you know you can go."
        lead="After the visa check says yes, the next question is how to get there. Enter your route and dates and we'll hand the search to outside flight suppliers with it already filled in. We don't show prices, because we can't stand behind a fare we didn't get from the airline."
      />
      <LinkSearch
        idPrefix="fl"
        button="Find flight searches"
        values={values}
        fields={[
          { name: "from", label: "From (city)", placeholder: "Chicago" },
          { name: "to", label: "To (city or country)", placeholder: "Japan", required: true },
          { name: "start", label: "Leave", type: "date" },
          { name: "end", label: "Return", type: "date" },
        ]}
      >
        {links.length > 0 && <BookingLinks flights={links} />}
      </LinkSearch>
    </>
  );
}
