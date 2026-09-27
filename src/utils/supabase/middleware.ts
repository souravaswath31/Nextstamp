import { createServerClient, type CookieOptionsWithName } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

type CookieToSet = { name: string; value: string; options?: CookieOptionsWithName };

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

// Refreshes the Supabase session cookie on every request so server components
// (which can only read cookies, not set them) always see a valid session.
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  // Touching getUser() is what actually triggers the token refresh.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // /my-trips has a sibling loading.tsx, and Next.js 14's App Router has a
  // known bug where redirect() called from a page in a route segment that
  // also has a loading.tsx (i.e. gets wrapped in Suspense) never produces a
  // real HTTP redirect for the initial document request — it only reaches
  // the client-side router, so a fresh/no-JS request just sees a blank
  // "loading" shell forever instead of being sent to /login. Gating it here
  // in middleware sidesteps the Suspense boundary entirely. (getCurrentUser's
  // own redirect() still fires as a defense-in-depth backstop for
  // server-action calls that don't go through middleware.)
  if (!user && request.nextUrl.pathname.startsWith("/my-trips")) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return supabaseResponse;
}
