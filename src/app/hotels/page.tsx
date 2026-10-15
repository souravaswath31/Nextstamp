import type { Metadata } from "next";
import ComingSoonPage from "@/components/site/ComingSoonPage";

export const metadata: Metadata = {
  title: "Hotels — NextStamp",
  description: "Hotel search links are coming to NextStamp. Join the waitlist.",
};

export default function HotelsPage() {
  return (
    <ComingSoonPage
      interest="hotels"
      eyebrow="Coming soon"
      title="Somewhere to stay, on the route you planned."
      lead="We're adding places to stay for each stop of a trip, so you don't re-enter the dates and the city somewhere else."
      how={
        <>
          <p>
            These will be links out to outside suppliers, labelled as such. NextStamp
            won&apos;t take payment for a room or hold your money; you book with the supplier.
          </p>
          <p>Today, a trip page already links to Google Hotels with your destination and dates filled in.</p>
        </>
      }
    />
  );
}
