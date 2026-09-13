import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "./prisma";

// Resolves the signed-in Supabase user to our own User row. Every call site
// that used to get the single hardcoded user now gets the real session's
// user, scoped to their own held documents and trips — the function's
// return shape hasn't changed, only where it comes from.
export async function getCurrentUser() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: authUser.id },
    include: { heldDocuments: true },
  });

  if (!user) {
    // Signed in via Supabase, but hasn't finished the one-time profile step yet.
    redirect("/onboarding");
  }

  return user;
}
