import { cookies } from "next/headers";
import { redirect } from "next/navigation";
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
    <div className="mx-auto max-w-sm space-y-8 py-16">
      <div>
        <p className="font-stamp text-xs uppercase tracking-widest text-ink/50">Welcome</p>
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
            className="mt-1 w-full border border-line bg-paper px-3 py-2 font-body text-sm text-ink"
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
            className="mt-1 w-full border border-line bg-paper px-3 py-2 font-body text-sm text-ink placeholder:text-ink/40"
          />
        </div>
        <button className="w-full border border-ink px-3 py-2 font-body text-sm text-ink hover:bg-ink hover:text-paper">
          Continue
        </button>
      </form>
    </div>
  );
}
