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
    <div className="space-y-10">
      <div className="relative overflow-hidden border border-line bg-gradient-to-br from-teal/10 via-paper to-coral/10 px-6 py-8 sm:px-8">
        <div className="flex items-center gap-4">
          <span className="stamp-mark flex h-14 w-14 shrink-0 items-center justify-center border-ink text-ink">
            <span className="font-display text-xl not-italic">{user.name.charAt(0).toUpperCase()}</span>
          </span>
          <div>
            <p className="font-stamp text-xs uppercase tracking-widest text-ink/50">Profile</p>
            <h1 className="mt-0.5 font-display text-3xl text-ink">{user.name}</h1>
            <p className="mt-0.5 font-body text-sm text-ink/70">Based in {user.homeBaseLocation ?? "—"}</p>
          </div>
        </div>

        <form action={updatePassportCountry} className="mt-4 flex items-center gap-2">
          <label className="font-stamp text-[11px] uppercase tracking-wide text-ink/50">
            Passport
          </label>
          <input
            name="passportCountry"
            defaultValue={user.passportCountry}
            className="border border-line bg-paper px-2 py-1 font-body text-sm text-ink focus:border-ink focus:outline-none"
          />
          <button className="border border-ink px-3 py-1 font-body text-xs text-ink transition-colors hover:bg-ink hover:text-paper">
            Update
          </button>
        </form>
      </div>

      <section>
        <h2 className="flex items-center gap-2 font-display text-xl text-ink">
          <FileStack size={19} className="text-ink/40" /> Held documents
        </h2>
        <p className="mt-1 font-body text-sm text-ink/60">
          Visas and residency permits beyond your passport — this is what the visa
          engine checks for cascade eligibility (e.g. a US visa unlocking a third country).
        </p>

        <div className="mt-4 space-y-2">
          {user.heldDocuments.map((doc) => {
            const expiry = getExpiryStatus(doc.validUntil);
            return (
              <div key={doc.id} className={`flex items-center justify-between border border-line border-l-4 bg-paper px-4 py-3 shadow-paper ${EXPIRY_SEVERITY_CLASSES[expiry.severity]}`}>
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

        <form action={addHeldDocument} className="mt-4 grid gap-2 border border-line bg-paper p-4 shadow-paper sm:grid-cols-4">
          <input
            name="country"
            placeholder="Country (e.g. USA)"
            required
            className="border border-line bg-paper px-2 py-1.5 font-body text-sm text-ink placeholder:text-ink/40 focus:border-ink focus:outline-none"
          />
          <input
            name="subtype"
            placeholder="Type (e.g. H1B)"
            className="border border-line bg-paper px-2 py-1.5 font-body text-sm text-ink placeholder:text-ink/40 focus:border-ink focus:outline-none"
          />
          <input
            name="validUntil"
            type="date"
            className="border border-line bg-paper px-2 py-1.5 font-body text-sm text-ink focus:border-ink focus:outline-none"
          />
          <button className="flex items-center justify-center gap-1.5 border border-ink px-3 py-1.5 font-body text-sm text-ink transition-colors hover:bg-ink hover:text-paper">
            <Plus size={15} /> Add document
          </button>
        </form>
      </section>

      <section>
        <h2 className="flex items-center gap-2 font-display text-xl text-ink">
          <Unlock size={19} className="text-ink/40" /> What opens up
        </h2>
        <p className="mt-1 font-body text-sm text-ink/60">
          Destinations that become easier because of a document you hold — beyond
          what your {user.passportCountry} passport gets you alone.
        </p>

        {cascadeSections.map(({ doc, unlocks }) => (
          <div key={doc.id} className="mt-4">
            <p className="font-stamp text-[11px] uppercase tracking-wide text-stamp">
              Via your {doc.country} {doc.subtype}
            </p>
            {unlocks.length === 0 ? (
              <p className="mt-2 font-body text-sm text-ink/50">
                No cascade rules on file for this document yet.
              </p>
            ) : (
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {unlocks.map((rule) => (
                  <div key={rule.id} className={`card-lift border-l-2 bg-paper px-3 py-2 ${VISA_STATUS_BORDER_CLASSES[rule.visaType] ?? "border-l-line bg-charcoal/5"}`}>
                    <p className="font-body text-sm text-ink">{rule.destinationCountry}</p>
                    <p className={`font-stamp text-[11px] uppercase ${VISA_STATUS_TEXT_CLASSES[rule.visaType] ?? "text-ink/60"}`}>{rule.visaType}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </section>

      <p className="border border-line bg-paperDark px-4 py-3 font-body text-xs text-ink/70">
        Visa rules shown throughout NextStamp are a starter reference set, not a
        maintained legal source — always confirm on the destination's official
        immigration site before booking or traveling.
      </p>

      <form action={signOutAction}>
        <button className="flex items-center gap-1.5 font-body text-xs text-ink/50 hover:text-ink hover:underline">
          <LogOut size={13} /> Sign out
        </button>
      </form>
    </div>
  );
}
