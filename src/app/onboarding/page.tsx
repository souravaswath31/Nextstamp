import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ArrowRight } from "lucide-react";
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
    <div
      className="-mx-5 flex min-h-[80vh] items-center justify-center rounded-hero bg-cover bg-center px-4 sm:-mx-8"
      style={{ backgroundImage: "url('/hero-bg.jpg')" }}
    >
      <div className="w-full max-w-sm space-y-8 rounded-hero bg-paper p-9 shadow-paper-lg">
        <div className="text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/illustration-onboarding-welcome.jpg"
            alt=""
            className="mx-auto h-28 w-auto"
          />
          <p className="mt-2 font-stamp text-xs uppercase tracking-widest text-ink/45">Welcome</p>
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
            <label
              htmlFor="onboarding-passport-country"
              className="font-stamp text-[11px] uppercase tracking-wide text-ink/45"
            >
              Passport country
            </label>
            <input
              id="onboarding-passport-country"
              name="passportCountry"
              placeholder="e.g. India"
              required
              className="mt-1.5 w-full rounded-full bg-paperDark px-4 py-2.5 font-body text-sm text-ink placeholder:text-ink/40 focus:outline-none focus:ring-2 focus:ring-ink/10"
            />
          </div>
          {/* Optional on purpose: asking for an expiry date at signup is a
              reasonable amount of friction to add, but making it required
              would turn a two-field form into a "go find your passport"
              errand. It can be filled in later on the profile page. */}
          <div>
            <label
              htmlFor="onboarding-passport-expiry"
              className="font-stamp text-[11px] uppercase tracking-wide text-ink/45"
            >
              Passport expiry <span className="normal-case tracking-normal">(optional)</span>
            </label>
            <input
              id="onboarding-passport-expiry"
              name="passportExpiry"
              type="date"
              className="mt-1.5 w-full rounded-full bg-paperDark px-4 py-2.5 font-body text-sm text-ink focus:outline-none focus:ring-2 focus:ring-ink/10"
            />
            <p className="mt-1.5 font-body text-xs text-ink/45">
              Lets us check each trip against the destination&apos;s own validity rule — the thing
              that actually stops people at check-in.
            </p>
          </div>
          <button className="btn-pill btn-pill-primary w-full">
            Continue <ArrowRight size={15} />
          </button>
        </form>
      </div>
    </div>
  );
}
