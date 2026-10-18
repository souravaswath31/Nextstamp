// Shared plumbing for the Escape Hatch route handlers.
import { NextResponse } from "next/server";
import { SITE_URL } from "@/lib/siteUrl";
import { GameError } from "./game";

export const TOKEN_HEADER = "x-escape-token";

export function clientIp(req: Request): string {
  return (req.headers.get("x-forwarded-for") ?? "unknown").split(",")[0].trim() || "unknown";
}

/** Same-origin only: another website must not be able to drive a game from a visitor's browser. */
export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true; // non-browser clients and same-site navigations send none
  const own = new URL(req.url).origin;
  return origin === own || origin === new URL(SITE_URL).origin;
}

export function fail(e: unknown): NextResponse {
  if (e instanceof GameError) return NextResponse.json({ error: e.message }, { status: e.status });
  console.error("escape error", e);
  return NextResponse.json({ error: "Something went wrong. Try again." }, { status: 500 });
}

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const body = await req.json();
    return body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
