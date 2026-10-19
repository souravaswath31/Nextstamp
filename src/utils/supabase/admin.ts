import { createClient } from "@supabase/supabase-js";

/**
 * Server-only client with the service-role key. It can delete auth users, so it is used for exactly
 * one thing (account deletion) and never imported from client code. Returns null when the key is not
 * set, so deletion still removes our own data and the page can say the sign-in record needs a manual step.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
