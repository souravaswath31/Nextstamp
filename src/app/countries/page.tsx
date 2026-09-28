import Link from "next/link";
import type { Metadata } from "next";
import { Plug, Phone, Banknote, ArrowRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import Reveal from "@/components/Reveal";
import { splitList } from "@/lib/countryFacts";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Country guides — NextStamp",
  description:
    "Entry requirements, climate month by month, money norms, plugs, emergency numbers and a phrasebook for every destination NextStamp covers. Sourced and dated, never generated.",
};

export default async function CountriesPage() {
  const facts = await prisma.countryFact.findMany({
    orderBy: { country: "asc" },
    include: { climate: { select: { id: true } }, phrases: { select: { id: true } } },
  });

  return (
    <div className="space-y-8">
      <div className="-mx-5 overflow-hidden rounded-hero sm:-mx-8">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/flatlay-passport-stamps.jpg"
          alt=""
          className="h-40 w-full object-cover sm:h-56"
        />
      </div>

      <div>
        <p className="font-stamp text-xs uppercase tracking-widest text-ink/45">Reference</p>
        <h1 className="mt-2 font-display text-5xl tracking-tightest text-ink sm:text-6xl">
          Country guides
        </h1>
        <p className="mt-3 max-w-2xl font-body text-lg text-ink/65">
          The things you need and nobody aggregates well: how long your passport has to be valid,
          which plug, what the emergency number actually is, whether anyone takes a card, and
          fourteen phrases worth knowing. Every fact carries its source and the date we checked it.
        </p>
      </div>

      {facts.length === 0 ? (
        <p className="rounded-panel bg-paper px-5 py-4 font-body text-sm text-ink/60 shadow-paper">
          No country guides are loaded yet.
        </p>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {facts.map((fact, i) => {
            const plugs = splitList(fact.powerPlugTypes);
            const emergency =
              fact.emergencyUniversal ?? fact.emergencyPolice ?? fact.emergencyAmbulance;
            return (
              <Reveal key={fact.id} delay={i * 40}>
                <Link
                  href={`/country/${fact.country.toLowerCase().replace(/\s+/g, "-")}`}
                  className="card-lift group flex h-full flex-col rounded-panel bg-paper p-5 shadow-paper"
                >
                  <h2 className="font-display text-xl text-ink">{fact.country}</h2>
                  <p className="mt-1 font-body text-xs text-ink/50">{fact.timezoneLabel}</p>

                  <dl className="mt-4 space-y-2">
                    <div className="flex items-center gap-2">
                      <Banknote size={13} className="shrink-0 text-ink/30" />
                      <dd className="font-body text-xs text-ink/65">
                        {fact.currencyCode} — {fact.currencyName}
                      </dd>
                    </div>
                    {plugs.length > 0 && (
                      <div className="flex items-center gap-2">
                        <Plug size={13} className="shrink-0 text-ink/30" />
                        <dd className="font-body text-xs text-ink/65">
                          Type {plugs.join("/")}
                          {fact.powerVoltage ? ` · ${fact.powerVoltage}` : ""}
                        </dd>
                      </div>
                    )}
                    {emergency && (
                      <div className="flex items-center gap-2">
                        <Phone size={13} className="shrink-0 text-ink/30" />
                        <dd className="font-body text-xs tabular-nums text-ink/65">{emergency}</dd>
                      </div>
                    )}
                  </dl>

                  <p className="mt-4 font-body text-xs text-ink/40">
                    {fact.climate.length > 0 && `${fact.climate.length}-month climate`}
                    {fact.climate.length > 0 && fact.phrases.length > 0 && " · "}
                    {fact.phrases.length > 0 && `${fact.phrases.length} phrases`}
                  </p>

                  <span className="mt-auto flex items-center gap-1 pt-4 font-body text-xs font-semibold text-coralDark">
                    Full guide
                    <ArrowRight
                      size={12}
                      className="transition-transform group-hover:translate-x-0.5"
                    />
                  </span>
                </Link>
              </Reveal>
            );
          })}
        </div>
      )}
    </div>
  );
}
