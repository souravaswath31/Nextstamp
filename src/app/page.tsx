import type { Metadata } from "next";
import { getOptionalUser } from "@/lib/currentUser";
import Dashboard from "@/components/Dashboard";
import Landing from "@/components/site/Landing";

// Depends on the session cookie: signed in, "/" is your dashboard; signed out,
// it is the public landing page.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "NextStamp — Can I go there with my passport?",
  description:
    "Check a destination against your passport and the visas you already hold. Every answer shows its official source and the date it was last verified.",
};

export default async function HomePage() {
  const user = await getOptionalUser();
  if (user) return <Dashboard />;
  return <Landing />;
}
