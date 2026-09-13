import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Stamp, ArrowRight } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { completeOnboarding } from "@/lib/actions";

// Shown once, right after a new magic-link sign-in, before a User row exists
// in our own database. getCurrentUser() (src/lib/currentUser.ts) redirects
// here whenever it finds a Supabase session with no matching User row.
export default async function OnboardingPage() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-8 border border-line bg-paper p-8 shadow-paper-lg">
        <div className="text-center">
          <span className="stamp-mark mx-auto flex h-14 w-14 items-center justify-center border-stamp text-stamp">
            <Stamp size={22} />
          </span>
          <p className="mt-3 font-stamp text-xs uppercase tracking-widest text-ink/50">Welcome</p>
          <h1 className="mt-1 font-display text-3xl text-ink">One more thing</h1>
          <p className="mt-2 font-body text-sm text-ink/60">
            The visa engine checks status against your actual passport — tell us which one you
            hold and we&apos;ll take it from there.
          </p>
        </div>

        <form action={completeOnboarding} className="space-y-3">
          <div>
            <label className="font-stamp text-[11px] uppercase tracking-wide text-ink/50">
              Name
            </label>
            <input
              name="name"
              defaultValue={authUser.email?.split("@")[0]}
              required
              className="mt-1 w-full border border-line bg-paper px-3 py-2 font-body text-sm text-ink focus:border-ink focus:outline-none"
            />
          </div>
          <div>
            <label className="font-stamp text-[11px] uppercase tracking-wide text-ink/50">
              Passport country
            </label>
            <input
              name="passportCountry"
              placeholder="e.g. India"
              required
              className="mt-1 w-full border border-line bg-paper px-3 py-2 font-body text-sm text-ink placeholder:text-ink/40 focus:border-ink focus:outline-none"
            />
          </div>
          <button className="flex w-full items-center justify-center gap-2 border border-ink bg-ink px-3 py-2.5 font-body text-sm font-medium text-paper transition-opacity hover:opacity-90">
            Continue <ArrowRight size={15} />
          </button>
        </form>
      </div>
    </div>
  );
}
