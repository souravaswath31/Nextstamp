import { NextResponse } from "next/server";
import { viewFor } from "@/lib/escape/game";
import { fail, TOKEN_HEADER } from "@/lib/escape/http";

export const dynamic = "force-dynamic";

// Polled every couple of seconds by each phone. `v` is the version it already has, so an unchanged
// room costs one cheap query and a tiny reply.
export async function GET(req: Request, { params }: { params: { code: string } }) {
  try {
    const url = new URL(req.url);
    const view = await viewFor(params.code, req.headers.get(TOKEN_HEADER), url.searchParams.get("v"));
    return NextResponse.json(view, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return fail(e);
  }
}
