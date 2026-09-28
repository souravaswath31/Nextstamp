import { getCurrentUser } from "@/lib/currentUser";
import { getCascadeExplorer, getEasyAccessDestinations, getVisaRequiredDestinations } from "@/lib/visa";
import Link from "next/link";
import { addHeldDocument, removeHeldDocument, updatePassportCountry, updatePassportExpiry, signOutAction } from "@/lib/actions";
import { VISA_STATUS_BORDER_CLASSES, VISA_STATUS_TEXT_CLASSES } from "@/lib/types";
import { getExpiryStatus, EXPIRY_SEVERITY_CLASSES } from "@/lib/documents";
import { listCountriesWithFacts } from "@/lib/countryFacts";
import { FileStack, Unlock, Trash2, Plus, LogOut, Globe2, FileWarning, ExternalLink } from "lucide-react";

export const dynamic = "force-dynamic";

const EASY_ACCESS_LABELS: Record<string, string> = {
  resident: "Already have status",
  "visa-free": "Visa-free",
  "visa-on-arrival": "Visa on arrival",
};

const VISA_REQUIRED_LABELS: Record<string, string> = {
  "e-visa": "e-Visa",
  "advance-visa-required": "Advance visa needed",
};

export default async function ProfilePage() {
  const user = await getCurrentUser();

  const [cascadeSections, easyAccess, visaRequired] = await Promise.all([
    Promise.all(
      user.heldDocuments.map(async (doc) => ({
        doc,
        unlocks: await getCascadeExplorer(user.passportCountry, doc.country),
      }))
    ),
    getEasyAccessDestinations(user),
    getVisaRequiredDestinations(user),
  ]);

  // Which of those destinations we have a researched country guide for, so the
  // card can link through instead of dead-ending at a status label.
  const guideCountries = new Set(await listCountriesWithFacts());

  // Reuses the held-document expiry engine — a passport is just the document
  // everything else hangs off, so the same severity thresholds apply.
  const passportExpiry = getExpiryStatus(user.passportExpiry);
  const passportExpiryValue = user.passportExpiry
    ? user.passportExpiry.toISOString().slice(0, 10)
    : "";

  return (
    <div className="space-y-14">
      <div className="relative overflow-hidden rounded-hero px-6 py-10 sm:px-10">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/flatlay-passport-stamps.jpg"
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-paper/80" />
        <div className="relative flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
          <span className="stamp-mark flex h-16 w-16 shrink-0 items-center justify-center border-ink text-ink bg-paper">
            <span className="font-display text-2xl">{user.name.charAt(0).toUpperCase()}</span>
          </span>
          <div>
            <p className="font-stamp text-xs uppercase tracking-widest text-ink/45">Profile</p>
            <h1 className="mt-0.5 font-display text-4xl tracking-tightest text-ink">{user.name}</h1>
            <p className="mt-0.5 font-body text-sm text-ink/60">Based in {user.homeBaseLocation ?? "—"}</p>
          </div>
        </div>

        <div className="relative mt-6 flex flex-wrap items-end justify-center gap-4 sm:justify-start">
          <form action={updatePassportCountry} className="flex items-center gap-2">
            <label
              htmlFor="passport-country"
              className="font-stamp text-[11px] uppercase tracking-wide text-ink/45"
            >
              Passport
            </label>
            <input
              id="passport-country"
              name="passportCountry"
              defaultValue={user.passportCountry}
              className="rounded-full bg-paper px-3 py-1.5 font-body text-sm text-ink shadow-paper focus:outline-none focus:ring-2 focus:ring-ink/10"
            />
            <button className="btn-pill btn-pill-primary !px-4 !py-1.5 !text-xs">
              Update
            </button>
          </form>

          {/* Passport expiry: the single most common reason someone gets turned
              away at check-in, and unknowable to us unless they tell us. Fed
              into every trip's entry-readiness check (src/lib/readiness.ts). */}
          <form action={updatePassportExpiry} className="flex items-center gap-2">
            <label
              htmlFor="passport-expiry"
              className="font-stamp text-[11px] uppercase tracking-wide text-ink/45"
            >
              Expires
            </label>
            <input
              id="passport-expiry"
              name="passportExpiry"
              type="date"
              defaultValue={passportExpiryValue}
              className="rounded-full bg-paper px-3 py-1.5 font-body text-sm text-ink shadow-paper focus:outline-none focus:ring-2 focus:ring-ink/10"
            />
            <button className="btn-pill btn-pill-primary !px-4 !py-1.5 !text-xs">
              Save
            </button>
          </form>
        </div>

        <div className="relative mt-3">
          {user.passportExpiry ? (
            <p
              className={`font-body text-xs ${
                passportExpiry.severity === "ok" || passportExpiry.severity === "none"
                  ? "text-ink/55"
                  : "font-semibold text-stampRed"
              }`}
            >
              {passportExpiry.label}
              {passportExpiry.severity === "ok" &&
                " — most destinations want six months' validity beyond your arrival date, so we check each trip against its own rule."}
            </p>
          ) : (
            <p className="flex items-center gap-1.5 font-body text-xs text-stamp">
              <FileWarning size={13} /> Add your passport&apos;s expiry date and every trip gets
              checked against the destination&apos;s own validity rule — the thing that stops people
              at check-in.
            </p>
          )}
        </div>
      </div>

      <section>
        <h2 className="flex items-center gap-2 font-display text-2xl text-ink">
          <FileStack size={20} className="text-ink/35" /> Held documents
        </h2>
        <p className="mt-1 font-body text-sm text-ink/55">
          Visas and residency permits beyond your passport — this is what the visa
          engine checks for cascade eligibility (e.g. a US visa unlocking a third country).
        </p>

        <div className="mt-5 space-y-3">
          {user.heldDocuments.map((doc) => {
            const expiry = getExpiryStatus(doc.validUntil);
            return (
              <div key={doc.id} className={`flex items-center justify-between rounded-panel border-l-4 bg-paper px-5 py-4 shadow-paper ${EXPIRY_SEVERITY_CLASSES[expiry.severity]}`}>
                <div>
                  <p className="font-body text-sm text-ink">
                    {doc.country} {doc.subtype ? `— ${doc.subtype}` : ""}
                  </p>
                  {doc.validUntil && (
                    <p className={`font-body text-xs ${expiry.severity === "ok" || expiry.severity === "none" ? "text-ink/50" : "font-semibold"}`}>
                      {expiry.label}
                    </p>
                  )}
                </div>
                <form action={removeHeldDocument.bind(null, doc.id)}>
                  <button className="flex items-center gap-1 font-body text-xs text-stampRed hover:underline">
                    <Trash2 size={13} /> Remove
                  </button>
                </form>
              </div>
            );
          })}
        </div>

        <form action={addHeldDocument} className="mt-4 grid gap-2 rounded-panel bg-paper p-5 shadow-paper sm:grid-cols-4">
          <input
            name="country"
            placeholder="Country (e.g. USA)"
            required
            className="rounded-card bg-paperDark px-3 py-2 font-body text-sm text-ink placeholder:text-ink/40 focus:outline-none focus:ring-2 focus:ring-ink/10"
          />
          <input
            name="subtype"
            placeholder="Type (e.g. H1B)"
            className="rounded-card bg-paperDark px-3 py-2 font-body text-sm text-ink placeholder:text-ink/40 focus:outline-none focus:ring-2 focus:ring-ink/10"
          />
          <input
            name="validUntil"
            type="date"
            className="rounded-card bg-paperDark px-3 py-2 font-body text-sm text-ink focus:outline-none focus:ring-2 focus:ring-ink/10"
          />
          <button className="btn-pill btn-pill-primary !rounded-card">
            <Plus size={15} /> Add document
          </button>
        </form>
      </section>

      <section>
        <h2 className="flex items-center gap-2 font-display text-2xl text-ink">
          <Globe2 size={20} className="text-ink/35" /> Where you can go without a visa hassle
        </h2>
        <p className="mt-1 font-body text-sm text-ink/55">
          Destinations your {user.passportCountry} passport{user.heldDocuments.length > 0 ? " and held documents" : ""}{" "}
          get you into visa-free, on arrival, or where you already hold status — no advance
          application needed. Limited to the {easyAccess.length + " "}
          {easyAccess.length === 1 ? "destination" : "destinations"} NextStamp has researched
          for this passport so far, not every country in the world.
        </p>

        {easyAccess.length === 0 ? (
          <p className="mt-4 font-body text-sm text-ink/50">
            No easy-access destinations on file yet for this passport — check back as the
            visa engine's coverage grows.
          </p>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {easyAccess.map((status) => (
              <div
                key={status.destinationCountry}
                className={`rounded-card border-l-2 bg-paper px-4 py-3 shadow-paper ${VISA_STATUS_BORDER_CLASSES[status.status] ?? "border-l-charcoal/30 bg-charcoal/5"}`}
              >
                <p className="font-body text-sm text-ink">{status.destinationCountry}</p>
                <p className={`font-stamp text-[11px] uppercase ${VISA_STATUS_TEXT_CLASSES[status.status] ?? "text-ink/60"}`}>
                  {EASY_ACCESS_LABELS[status.status] ?? status.status}
                  {status.viaCascade ? " · via held document" : ""}
                </p>
                {guideCountries.has(status.destinationCountry) && (
                  <Link
                    href={`/country/${status.destinationCountry.toLowerCase().replace(/\s+/g, "-")}`}
                    className="mt-1.5 inline-block font-body text-xs font-semibold text-coralDark hover:underline"
                  >
                    Country guide
                  </Link>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="flex items-center gap-2 font-display text-2xl text-ink">
          <FileWarning size={20} className="text-ink/35" /> Where you'll need a visa
        </h2>
        <p className="mt-1 font-body text-sm text-ink/55">
          Destinations your {user.passportCountry} passport can reach, but only after
          arranging a visa first — an e-Visa applied for online, or a full advance
          application through an embassy or consulate. Each links to the official source
          so you can start there.
        </p>

        {visaRequired.length === 0 ? (
          <p className="mt-4 font-body text-sm text-ink/50">
            No visa-required destinations on file yet for this passport.
          </p>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {visaRequired.map((status) => (
              <div
                key={status.destinationCountry}
                className={`flex flex-col gap-2 rounded-card border-l-2 bg-paper px-4 py-3 shadow-paper ${VISA_STATUS_BORDER_CLASSES[status.status] ?? "border-l-charcoal/30 bg-charcoal/5"}`}
              >
                <div>
                  <p className="font-body text-sm text-ink">{status.destinationCountry}</p>
                  <p className={`font-stamp text-[11px] uppercase ${VISA_STATUS_TEXT_CLASSES[status.status] ?? "text-ink/60"}`}>
                    {VISA_REQUIRED_LABELS[status.status] ?? status.status}
                    {status.viaCascade ? " · via held document" : ""}
                  </p>
                </div>
                {status.conditionsText && (
                  <p className="font-body text-xs text-ink/55">{status.conditionsText}</p>
                )}
                {status.sourceUrl && (
                  <a
                    href={status.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-auto flex items-center gap-1.5 font-body text-xs text-forest underline decoration-forest/40 underline-offset-2 hover:decoration-forest"
                  >
                    Start application <ExternalLink size={12} />
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="flex flex-col items-center gap-4 sm:flex-row">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/illustration-visa-cascade.jpg" alt="" className="h-24 w-auto shrink-0" />
          <div>
            <h2 className="flex items-center gap-2 font-display text-2xl text-ink">
              <Unlock size={20} className="text-ink/35" /> What opens up
            </h2>
            <p className="mt-1 font-body text-sm text-ink/55">
              Destinations that become easier because of a document you hold — beyond
              what your {user.passportCountry} passport gets you alone.
            </p>
          </div>
        </div>

        {cascadeSections.map(({ doc, unlocks }) => (
          <div key={doc.id} className="mt-5">
            <p className="font-stamp text-[11px] uppercase tracking-wide text-stamp">
              Via your {doc.country} {doc.subtype}
            </p>
            {unlocks.length === 0 ? (
              <p className="mt-2 font-body text-sm text-ink/50">
                No cascade rules on file for this document yet.
              </p>
            ) : (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {unlocks.map((rule) => (
                  <div key={rule.id} className={`card-lift rounded-card border-l-2 bg-paper px-4 py-3 shadow-paper ${VISA_STATUS_BORDER_CLASSES[rule.visaType] ?? "border-l-line bg-charcoal/5"}`}>
                    <p className="font-body text-sm text-ink">{rule.destinationCountry}</p>
                    <p className={`font-stamp text-[11px] uppercase ${VISA_STATUS_TEXT_CLASSES[rule.visaType] ?? "text-ink/60"}`}>{rule.visaType}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </section>

      <p className="rounded-panel bg-paperDark px-5 py-4 font-body text-xs text-ink/60">
        Visa rules shown throughout NextStamp are a starter reference set, not a
        maintained legal source — always confirm on the destination's official
        immigration site before booking or traveling.
      </p>

      <form action={signOutAction}>
        <button className="flex items-center gap-1.5 font-body text-xs text-ink/45 hover:text-ink hover:underline">
          <LogOut size={13} /> Sign out
        </button>
      </form>
    </div>
  );
}
