import type { Metadata } from "next";
import ComingSoonPage from "@/components/site/ComingSoonPage";

export const metadata: Metadata = {
  title: "Flights — NextStamp",
  description: "Flight search links are coming to NextStamp. Join the waitlist.",
};

export default function FlightsPage() {
  return (
    <ComingSoonPage
      interest="flights"
      eyebrow="Coming soon"
      title="Flights, once you know you can go."
      lead="After the visa check says yes, the next question is how to get there. We're adding flight search from your trip's dates and route."
      how={
        <>
          <p>
            These will be links out to outside flight suppliers, labelled as such. NextStamp
            won&apos;t take payment for a flight, hold your money or issue a ticket; you book with the
            supplier.
          </p>
          <p>Today, a trip page already links to Google Flights and Kayak with your route and dates filled in.</p>
        </>
      }
    />
  );
}
