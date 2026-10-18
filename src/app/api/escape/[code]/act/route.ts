import { NextResponse } from "next/server";
import { act, type Action } from "@/lib/escape/game";
import { fail, readJson, sameOrigin, TOKEN_HEADER } from "@/lib/escape/http";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: { code: string } }) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "Bad origin." }, { status: 403 });
  try {
    const body = (await readJson(req)) as unknown as Action;
    if (!body || typeof (body as { type?: unknown }).type !== "string") return NextResponse.json({ error: "Missing action." }, { status: 400 });
    await act(params.code, req.headers.get(TOKEN_HEADER), body);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
