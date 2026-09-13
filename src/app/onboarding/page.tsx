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
      <div className="w-full max-w-sm space-y-8 rounded-hero bg-paper p-9 shadow-paper-lg">
        <div className="text-center">
          <span className="stamp-mark mx-auto flex h-14 w-14 items-center justify-center border-stamp text-stamp">
            <Stamp size={22} />
          </span>
          <p className="mt-4 font-stamp text-xs uppercase tracking-widest text-ink/45">Welcome</p>
          <h1 className="mt-1 font-display text-3xl tracking-tightest text-ink">One more thing</h1>
          <p className="mt-2 font-body text-sm text-ink/55">
            The visa engine checks status against your actual passport — tell us which one you
            hold and we&apos;ll take it from there.
          </p>
        </div>

        <form action={completeOnboarding} className="space-y-4">
          <div>
            <label className="font-stamp text-[11px] uppercase tracking-wide text-ink/45">
              Name
            </label>
            <input
              name="name"
              defaultValue={authUser.email?.split("@")[0]}
              required
              className="mt-1.5 w-full rounded-full bg-paperDark px-4 py-2.5 font-body text-sm text-ink focus:outline-none focus:ring-2 focus:ring-ink/10"
            />
          </div>
          <div>
            <label className="font-stamp text-[11px] uppercase tracking-wide text-ink/45">
              Passport country
            </label>
            <input
              name="passportCountry"
              placeholder="e.g. India"
              required
              className="mt-1.5 w-full rounded-full bg-paperDark px-4 py-2.5 font-body text-sm text-ink placeholder:text-ink/40 focus:outline-none focus:ring-2 focus:ring-ink/10"
            />
          </div>
          <button className="btn-pill btn-pill-primary w-full">
            Continue <ArrowRight size={15} />
          </button>
        </form>
      </div>
    </div>
  );
}
