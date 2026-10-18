import type { Metadata } from "next";
import EscapeLanding from "@/components/escape/EscapeLanding";
import { STATE_CENTROIDS } from "@/lib/escape/stateCentroids";

export const metadata: Metadata = {
  title: "Escape Hatch, the weekend trip game — NextStamp",
  description:
    "Four questions, one veto each, and a trip nobody can back out of. Play with friends on your own phones and walk away with a real weekend itinerary.",
};

export default function EscapePage() {
  const states = Object.entries(STATE_CENTROIDS)
    .map(([slug, s]) => ({ slug, name: s.name }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return <EscapeLanding states={states} />;
}
