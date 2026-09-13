import { getCurrentUser } from "@/lib/currentUser";
import { getCascadeExplorer } from "@/lib/visa";
import { addHeldDocument, removeHeldDocument, updatePassportCountry, signOutAction } from "@/lib/actions";
import { VISA_STATUS_BORDER_CLASSES, VISA_STATUS_TEXT_CLASSES } from "@/lib/types";
import { getExpiryStatus, EXPIRY_SEVERITY_CLASSES } from "@/lib/documents";
import { FileStack, Unlock, Trash2, Plus, LogOut } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const user = await getCurrentUser();

  const cascadeSections = await Promise.all(
    user.heldDocuments.map(async (doc) => ({
      doc,
      unlocks: await getCascadeExplorer(user.passportCountry, doc.country),
    }))
  );

  return (
    <div className="space-y-14">
      <div className="relative overflow-hidden rounded-hero bg-gradient-to-br from-teal/10 via-paper to-coral/10 px-6 py-10 sm:px-10">
        <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
          <span className="stamp-mark flex h-16 w-16 shrink-0 items-center justify-center border-ink text-ink">
            <span className="font-display text-2xl">{user.name.charAt(0).toUpperCase()}</span>
          </span>
          <div>
            <p className="font-stamp text-xs uppercase tracking-widest text-ink/45">Profile</p>
            <h1 className="mt-0.5 font-display text-4xl tracking-tightest text-ink">{user.name}</h1>
            <p className="mt-0.5 font-body text-sm text-ink/60">Based in {user.homeBaseLocation ?? "—"}</p>
          </div>
        </div>

        <form action={updatePassportCountry} className="mt-6 flex items-center justify-center gap-2 sm:justify-start">
          <label className="font-stamp text-[11px] uppercase tracking-wide text-ink/45">
            Passport
          </label>
          <input
            name="passportCountry"
            defaultValue={user.passportCountry}
            className="rounded-full bg-paper px-3 py-1.5 font-body text-sm text-ink shadow-paper focus:outline-none focus:ring-2 focus:ring-ink/10"
          />
          <button className="btn-pill btn-pill-primary !px-4 !py-1.5 !text-xs">
            Update
          </button>
        </form>
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
          <Unlock size={20} className="text-ink/35" /> What opens up
        </h2>
        <p className="mt-1 font-body text-sm text-ink/55">
          Destinations that become easier because of a document you hold — beyond
          what your {user.passportCountry} passport gets you alone.
        </p>

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
