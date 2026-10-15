import type { Metadata } from "next";
import ComingSoonPage from "@/components/site/ComingSoonPage";

export const metadata: Metadata = {
  title: "Activities — NextStamp",
  description: "Tours and activity links are coming to NextStamp. Join the waitlist.",
};

export default function ActivitiesPage() {
  return (
    <ComingSoonPage
      interest="activities"
      eyebrow="Coming soon"
      title="Tours and tickets for the stops on your trip."
      lead="We're adding links to book the tours, tickets and experiences that match the places in your itinerary."
      how={
        <p>
          These will be links out to outside suppliers, labelled as such. NextStamp won&apos;t take
          payment for an activity or hold your money; you book with the supplier.
        </p>
      }
    />
  );
}
