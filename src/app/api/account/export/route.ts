import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { exportAccount } from "@/lib/accountData";

export const dynamic = "force-dynamic";

// A signed-in person downloads their own data as JSON. GET with no state change, and the response
// is never cached, so a shared machine cannot replay it.
export async function GET() {
  const supabase = createClient(await cookies());
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to download your data." }, { status: 401 });
  const data = await exportAccount(user.id);
  if (!data) return NextResponse.json({ error: "No account found." }, { status: 404 });
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": 'attachment; filename="nextstamp-my-data.json"',
      "Cache-Control": "no-store",
    },
  });
}
