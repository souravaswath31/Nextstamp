import type { Metadata } from "next";
import BookingLinks from "@/components/BookingLinks";
import LinkSearch from "@/components/site/LinkSearch";
import { PageHeader } from "@/components/site/MarketingBits";
import { activityLinks } from "@/lib/bookingLinks";

export const metadata: Metadata = {
  title: "Activities — NextStamp",
  description: "Tour and ticket searches for the places on your trip, on outside suppliers. NextStamp doesn't sell tickets.",
};
export const dynamic = "force-dynamic";

const str = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim().slice(0, 80) ?? "";

export default function ActivitiesPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const values = { to: str(searchParams.to), place: str(searchParams.place) };
  const groups = activityLinks({ destination: values.to }, values.place ? [values.place] : []);
  return (
    <>
      <PageHeader
        eyebrow="Activities"
        title="Tours and tickets for the stops on your trip."
        lead="Name a destination, and a place in it if you have one, and we'll hand the search to outside tour suppliers. Inside a trip, the places you've saved get their own links."
      />
      <LinkSearch
        idPrefix="ac"
        button="Find tours and tickets"
        values={values}
        fields={[
          { name: "to", label: "Where", placeholder: "Peru", required: true },
          { name: "place", label: "A specific place (optional)", placeholder: "Machu Picchu" },
        ]}
      >
        {groups.length > 0 && <BookingLinks activities={groups} />}
      </LinkSearch>
    </>
  );
}
