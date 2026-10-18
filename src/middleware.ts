import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/utils/supabase/middleware";
import { authCodeLandingRedirect } from "@/lib/authLanding";

export async function middleware(request: NextRequest) {
  const forward = authCodeLandingRedirect(request.nextUrl.pathname, request.nextUrl.search);
  if (forward) return NextResponse.redirect(new URL(forward, request.url));
  return await updateSession(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
