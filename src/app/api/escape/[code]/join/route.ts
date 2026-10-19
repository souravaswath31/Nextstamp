import { NextResponse } from "next/server";
import { withinLimit } from "@/lib/rateLimitDb";
import { joinGame } from "@/lib/escape/game";
import { clientIp, fail, readJson, sameOrigin } from "@/lib/escape/http";

export const dynamic = "force-dynamic";


export async function POST(req: Request, { params }: { params: { code: string } }) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "Bad origin." }, { status: 403 });
  if (!(await withinLimit("escape-join", clientIp(req), 40, 3600))) return NextResponse.json({ error: "Too many tries. Wait a bit and try again." }, { status: 429 });
  try {
    const body = await readJson(req);
    const { token } = await joinGame(params.code, body.name);
    return NextResponse.json({ token });
  } catch (e) {
    return fail(e);
  }
}
