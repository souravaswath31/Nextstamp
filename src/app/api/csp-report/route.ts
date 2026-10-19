import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Receives Content-Security-Policy-Report-Only violations and writes one short line each to the
// server log, so the policy can be tightened from evidence before it is enforced.
export async function POST(req: Request) {
  try {
    const text = (await req.text()).slice(0, 1500);
    console.warn("[csp-report]", text.replace(/\s+/g, " "));
  } catch {
    /* a malformed report is not worth a failure */
  }
  return new NextResponse(null, { status: 204 });
}
