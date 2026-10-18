import type { Metadata } from "next";
import Room from "@/components/escape/Room";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: { code: string } }): Promise<Metadata> {
  return {
    title: `Escape Hatch, room ${params.code.toUpperCase()} — NextStamp`,
    robots: { index: false, follow: false },
  };
}

export default function EscapeRoomPage({ params }: { params: { code: string } }) {
  return <Room code={params.code.toUpperCase()} />;
}
