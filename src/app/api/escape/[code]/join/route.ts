import { NextResponse } from "next/server";
import { makeRateLimiter } from "@/lib/waitlist";
import { joinGame } from "@/lib/escape/game";
import { clientIp, fail, readJson, sameOrigin } from "@/lib/escape/http";

export const dynamic = "force-dynamic";

const allow = makeRateLimiter(40, 60 * 60 * 1000);

export async function POST(req: Request, { params }: { params: { code: string } }) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "Bad origin." }, { status: 403 });
  if (!allow(clientIp(req))) return NextResponse.json({ error: "Too many tries. Wait a bit and try again." }, { status: 429 });
  try {
    const body = await readJson(req);
    const { token } = await joinGame(params.code, body.name);
    return NextResponse.json({ token });
  } catch (e) {
    return fail(e);
  }
}
