import { NextResponse } from "next/server";
import { withinLimit } from "@/lib/rateLimitDb";
import { createGame } from "@/lib/escape/game";
import { clientIp, fail, readJson, sameOrigin } from "@/lib/escape/http";

export const dynamic = "force-dynamic";

// Rooms are free and need no account, so a script could make many. This is best-effort only
// (serverless instances do not share memory), but it stops one browser tab hammering the button.

export async function POST(req: Request) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "Bad origin." }, { status: 403 });
  if (!(await withinLimit("escape-create", clientIp(req), 12, 3600))) return NextResponse.json({ error: "That's a lot of games. Try again in a bit." }, { status: 429 });
  try {
    const body = await readJson(req);
    const { code, token } = await createGame(body.name, body.fromState);
    return NextResponse.json({ code, token });
  } catch (e) {
    return fail(e);
  }
}
