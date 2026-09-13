import { createServerClient, type CookieOptionsWithName } from "@supabase/ssr";
import type { cookies } from "next/headers";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

type CookieToSet = { name: string; value: string; options?: CookieOptionsWithName };

// Used from Server Components, Server Actions, and Route Handlers — the
// cookie store's `set` throws when called from a Server Component (cookies
// are read-only there), which is fine as long as middleware.ts is refreshing
// the session on every request.
export function createClient(cookieStore: Awaited<ReturnType<typeof cookies>>) {
  return createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Called from a Server Component — ignored, middleware refreshes sessions.
        }
      },
    },
  });
}
