import {
  AlertTriangle,
  Banknote,
  CalendarDays,
  ExternalLink,
  HeartPulse,
  Languages,
  Phone,
  Plug,
  Signal,
  Thermometer,
  Train,
} from "lucide-react";
import {
  CLIMATE_RATING_CLASSES,
  CLIMATE_RATING_LABELS,
  parseTransitPasses,
  splitList,
  type CountryFactFull,
} from "@/lib/countryFacts";
import { formatHolidayDate, type PublicHoliday } from "@/lib/holidays";
import {
  fcdoAlertLabel,
  STATE_DEPT_LEVEL_CLASSES,
  type FcdoAdvisory,
  type StateDeptAdvisory,
} from "@/lib/advisories";
import type { ConversionResult } from "@/lib/currency";
import type { CountryClimate } from "@prisma/client";
import LocalTime from "./LocalTime";

// Everything about a destination that isn't the visa answer. Used by both the
// trip page (scoped to the trip's dates) and the standalone country guide
// (no dates, so the date-scoped props are simply absent).

type Props = {
  fact: CountryFactFull;
  /** Holidays inside the trip's dates, or the next few when there are none. */
  holidays: PublicHoliday[];
  holidaysAreForTrip: boolean;
  /** Climate rows for the travel month(s), or all 12 on the country guide. */
  climate: CountryClimate[];
  rate: ConversionResult | null;
  fcdo: FcdoAdvisory | null;
  stateDept: StateDeptAdvisory | null;
};

function SourceLink({ url }: { url: string | null | undefined }) {
  if (!url) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-2 inline-flex items-center gap-1 font-body text-[11px] font-semibold text-ink/40 hover:text-coralDark hover:underline"
    >
      Source <ExternalLink size={10} />
    </a>
  );
}

function MonthHeading({ month: m }: { month: CountryClimate }) {
  return (
    <div className="flex flex-wrap items-baseline gap-2">
      <span className="font-body text-sm font-semibold text-ink">{m.month}</span>
      {m.avgHighC !== null && m.avgLowC !== null && (
        <span className="font-body text-xs tabular-nums text-ink/60">
          {m.avgHighC}° / {m.avgLowC}°C
        </span>
      )}
      <span
        className={`rounded-full px-2 py-0.5 font-body text-[11px] font-semibold ${
          CLIMATE_RATING_CLASSES[m.rating] ?? "bg-ink/5 text-ink/50"
        }`}
      >
        {CLIMATE_RATING_LABELS[m.rating] ?? m.rating}
      </span>
    </div>
  );
}

function Card({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-panel bg-paper p-5 shadow-paper">
      <h3 className="flex items-center gap-2 font-display text-base text-ink">
        <span className="text-ink/35">{icon}</span>
        {title}
      </h3>
      <div className="mt-2.5">{children}</div>
    </div>
  );
}

export default function DestinationBriefing({
  fact,
  holidays,
  holidaysAreForTrip,
  climate,
  rate,
  fcdo,
  stateDept,
}: Props) {
  const requiredVax = splitList(fact.healthRequiredVaccinations);
  const recommendedVax = splitList(fact.healthRecommendedVaccinations);
  const plugs = splitList(fact.powerPlugTypes);
  const passes = parseTransitPasses(fact.transitPassesJson);
  const hasAdvisory = Boolean(fcdo || stateDept);

  // A trip spans one or two months and belongs inline with the other cards; a
  // full year is a reference table and gets its own full-width section below,
  // laid out in columns. Split on the number of months rather than on a
  // caller-supplied flag, so an unusually long trip behaves sensibly too.
  const isFullYearView = climate.length > 3;
  const shortClimate = isFullYearView ? [] : climate;

  return (
    <div className="space-y-5">
      {/* --- Advisories. Two governments, deliberately, because when they
          --- disagree that itself is the useful signal. */}
      {hasAdvisory && (
        <section className="rounded-panel bg-paper p-5 shadow-paper">
          <h3 className="flex items-center gap-2 font-display text-base text-ink">
            <AlertTriangle size={16} className="text-ink/35" /> Government advisories
          </h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {stateDept && (
              <div className="rounded-card bg-paperDark px-4 py-3">
                <p className="font-stamp text-[11px] uppercase tracking-wide text-ink/45">
                  US State Department
                </p>
                <span
                  className={`mt-1.5 inline-block rounded-full px-2.5 py-0.5 font-body text-xs font-semibold ${
                    stateDept.level ? STATE_DEPT_LEVEL_CLASSES[stateDept.level] : "bg-ink/5 text-ink/60"
                  }`}
                >
                  {stateDept.levelText}
                </span>
                {stateDept.publishedAt && (
                  <p className="mt-1.5 font-body text-[11px] text-ink/45">
                    Updated {stateDept.publishedAt}
                  </p>
                )}
                <SourceLink url={stateDept.url} />
              </div>
            )}
            {fcdo && (
              <div className="rounded-card bg-paperDark px-4 py-3">
                <p className="font-stamp text-[11px] uppercase tracking-wide text-ink/45">
                  UK Foreign Office
                </p>
                {fcdo.alertStatus.length > 0 ? (
                  <span className="mt-1.5 inline-block rounded-full bg-stampRed/10 px-2.5 py-0.5 font-body text-xs font-semibold text-stampRed">
                    {fcdoAlertLabel(fcdo.alertStatus[0])}
                  </span>
                ) : (
                  <span className="mt-1.5 inline-block rounded-full bg-forest/10 px-2.5 py-0.5 font-body text-xs font-semibold text-forest">
                    No travel-against advisory in force
                  </span>
                )}
                {fcdo.summary && (
                  <p className="mt-2 line-clamp-4 whitespace-pre-line font-body text-xs text-ink/65">
                    {fcdo.summary}
                  </p>
                )}
                <SourceLink url={fcdo.url} />
              </div>
            )}
          </div>
          {fcdo && (
            // Open Government Licence v3.0 requires attribution for FCDO
            // content. Don't remove this.
            <p className="mt-3 font-body text-[11px] text-ink/35">
              UK advisory content © Crown copyright, contains public sector information licensed
              under the{" "}
              <a
                href="https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/"
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                Open Government Licence v3.0
              </a>
              . US advisory content is public domain.
            </p>
          )}
        </section>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        {/* --- Holidays. The thing that quietly ruins a carefully planned day. */}
        {holidays.length > 0 && (
          <Card icon={<CalendarDays size={16} />} title={holidaysAreForTrip ? "Public holidays during your stay" : "Next public holidays"}>
            <p className="font-body text-xs text-ink/55">
              Museums and banks close, transport fills up, prices rise.
            </p>
            <ul className="mt-2.5 space-y-1.5">
              {holidays.map((h) => (
                <li key={`${h.date}-${h.name}`} className="flex items-baseline justify-between gap-3">
                  <span className="font-body text-sm text-ink">{h.localName}</span>
                  <span className="shrink-0 font-body text-xs tabular-nums text-ink/50">
                    {formatHolidayDate(h.date)}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-2.5 font-body text-[11px] text-ink/35">
              Holiday data from Nager.Date.
            </p>
          </Card>
        )}

        {/* --- Climate for the actual travel month. A trip touches one or two
            --- months, which sits fine beside the other cards; the full
            --- twelve-month reference is rendered below the grid instead,
            --- because a 12-entry card towers over everything next to it. */}
        {shortClimate.length > 0 && (
          <Card icon={<Thermometer size={16} />} title="Weather you're walking into">
            {fact.climateReferenceCity && (
              <p className="font-body text-xs text-ink/50">
                Averages for {fact.climateReferenceCity}.
              </p>
            )}
            <ul className="mt-2.5 space-y-2.5">
              {shortClimate.map((m) => (
                <li key={m.monthNumber}>
                  <MonthHeading month={m} />
                  {m.precipitationNote && (
                    <p className="mt-0.5 font-body text-xs text-ink/60">{m.precipitationNote}</p>
                  )}
                  {m.crowdNote && (
                    <p className="mt-0.5 font-body text-xs text-ink/45">{m.crowdNote}</p>
                  )}
                </li>
              ))}
            </ul>
            <SourceLink url={fact.climateSourceUrl} />
          </Card>
        )}

        {/* --- Money: rate plus the norms that actually catch people out. */}
        <Card icon={<Banknote size={16} />} title="Money">
          <p className="font-body text-sm text-ink">
            {fact.currencyName} ({fact.currencyCode})
          </p>
          {rate?.supported && rate.rate ? (
            <p className="mt-1 font-body text-sm tabular-nums text-ink/70">
              $1 ≈ {rate.rate.toLocaleString("en-US", { maximumFractionDigits: 2 })}{" "}
              {fact.currencyCode}
              {rate.asOf && (
                <span className="font-body text-xs text-ink/40"> · ECB rate, {rate.asOf}</span>
              )}
            </p>
          ) : (
            <p className="mt-1 font-body text-xs text-ink/50">
              The European Central Bank&apos;s free rate feed doesn&apos;t cover{" "}
              {fact.currencyCode}, so we&apos;re not showing a rate rather than showing a guess.
            </p>
          )}
          <dl className="mt-3 space-y-2">
            {fact.moneyCardAcceptance && (
              <div>
                <dt className="font-stamp text-[11px] uppercase tracking-wide text-ink/45">Cards</dt>
                <dd className="font-body text-sm text-ink/70">{fact.moneyCardAcceptance}</dd>
              </div>
            )}
            {fact.moneyCashCulture && (
              <div>
                <dt className="font-stamp text-[11px] uppercase tracking-wide text-ink/45">Cash</dt>
                <dd className="font-body text-sm text-ink/70">{fact.moneyCashCulture}</dd>
              </div>
            )}
            {fact.moneyTipping && (
              <div>
                <dt className="font-stamp text-[11px] uppercase tracking-wide text-ink/45">Tipping</dt>
                <dd className="font-body text-sm text-ink/70">{fact.moneyTipping}</dd>
              </div>
            )}
            {fact.moneyAtmNotes && (
              <div>
                <dt className="font-stamp text-[11px] uppercase tracking-wide text-ink/45">ATMs</dt>
                <dd className="font-body text-sm text-ink/70">{fact.moneyAtmNotes}</dd>
              </div>
            )}
          </dl>
          <SourceLink url={fact.moneySourceUrl} />
        </Card>

        {/* --- Time. */}
        <Card icon={<Thermometer size={16} />} title="Time">
          <LocalTime
            zone={fact.primaryTimezone}
            label={fact.timezoneLabel}
            note={fact.timezoneNote}
          />
        </Card>

        {/* --- Health. */}
        {(requiredVax.length > 0 || recommendedVax.length > 0 || fact.healthNotes || fact.healthMalariaRisk) && (
          <Card icon={<HeartPulse size={16} />} title="Health">
            {requiredVax.length > 0 && (
              <div className="mb-2.5">
                <p className="font-stamp text-[11px] uppercase tracking-wide text-stampRed">
                  Required
                </p>
                <p className="font-body text-sm text-ink/75">{requiredVax.join(", ")}</p>
              </div>
            )}
            {recommendedVax.length > 0 && (
              <div className="mb-2.5">
                <p className="font-stamp text-[11px] uppercase tracking-wide text-ink/45">
                  Recommended
                </p>
                <p className="font-body text-sm text-ink/70">{recommendedVax.join(", ")}</p>
              </div>
            )}
            {fact.healthMalariaRisk && (
              <p className="font-body text-sm text-ink/70">
                <span className="font-semibold">Malaria risk:</span> {fact.healthMalariaRisk}
              </p>
            )}
            {fact.healthNotes && (
              <p className="mt-1.5 font-body text-sm text-ink/65">{fact.healthNotes}</p>
            )}
            <SourceLink url={fact.healthSourceUrl} />
          </Card>
        )}

        {/* --- Plugs. Tiny data set, wildly useful. */}
        {(plugs.length > 0 || fact.powerVoltage) && (
          <Card icon={<Plug size={16} />} title="Power">
            <p className="font-body text-sm text-ink">
              {plugs.length > 0 && (
                <>
                  Plug type{plugs.length === 1 ? "" : "s"} {plugs.join(", ")}
                  {fact.powerVoltage ? " · " : ""}
                </>
              )}
              {fact.powerVoltage}
              {fact.powerFrequency ? ` · ${fact.powerFrequency}` : ""}
            </p>
            {fact.powerAdapterNote && (
              <p className="mt-1.5 font-body text-sm text-ink/65">{fact.powerAdapterNote}</p>
            )}
            <SourceLink url={fact.powerSourceUrl} />
          </Card>
        )}

        {/* --- Emergency numbers. The one card you hope stays unread. */}
        {(fact.emergencyPolice || fact.emergencyAmbulance || fact.emergencyUniversal) && (
          <Card icon={<Phone size={16} />} title="Emergency numbers">
            <div className="grid grid-cols-2 gap-2.5">
              {fact.emergencyUniversal && (
                <div>
                  <p className="font-stamp text-[11px] uppercase tracking-wide text-ink/45">All emergencies</p>
                  <p className="font-display text-xl tabular-nums text-stampRed">{fact.emergencyUniversal}</p>
                </div>
              )}
              {fact.emergencyPolice && (
                <div>
                  <p className="font-stamp text-[11px] uppercase tracking-wide text-ink/45">Police</p>
                  <p className="font-display text-xl tabular-nums text-ink">{fact.emergencyPolice}</p>
                </div>
              )}
              {fact.emergencyAmbulance && (
                <div>
                  <p className="font-stamp text-[11px] uppercase tracking-wide text-ink/45">Ambulance</p>
                  <p className="font-display text-xl tabular-nums text-ink">{fact.emergencyAmbulance}</p>
                </div>
              )}
              {fact.emergencyFire && (
                <div>
                  <p className="font-stamp text-[11px] uppercase tracking-wide text-ink/45">Fire</p>
                  <p className="font-display text-xl tabular-nums text-ink">{fact.emergencyFire}</p>
                </div>
              )}
              {fact.emergencyTouristPolice && (
                <div>
                  <p className="font-stamp text-[11px] uppercase tracking-wide text-ink/45">Tourist police</p>
                  <p className="font-display text-xl tabular-nums text-ink">{fact.emergencyTouristPolice}</p>
                </div>
              )}
            </div>
            {fact.emergencyNotes && (
              <p className="mt-2.5 font-body text-xs text-ink/60">{fact.emergencyNotes}</p>
            )}
            <SourceLink url={fact.emergencySourceUrl} />
          </Card>
        )}

        {/* --- Getting around. */}
        {(fact.transitSummary || passes.length > 0) && (
          <Card icon={<Train size={16} />} title="Getting around">
            {fact.transitSummary && (
              <p className="font-body text-sm text-ink/70">{fact.transitSummary}</p>
            )}
            {passes.length > 0 && (
              <ul className="mt-3 space-y-2.5">
                {passes.map((p) => (
                  <li key={p.name} className="rounded-card bg-paperDark px-3.5 py-2.5">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <span className="font-body text-sm font-semibold text-ink">{p.name}</span>
                      {p.buy_before_arrival === true && (
                        <span className="rounded-full bg-stamp/12 px-2 py-0.5 font-body text-[11px] font-semibold text-stamp">
                          Buy before you fly
                        </span>
                      )}
                    </div>
                    {p.covers && <p className="mt-0.5 font-body text-xs text-ink/60">{p.covers}</p>}
                    {p.worth_it && (
                      <p className="mt-1 font-body text-xs text-ink/70">
                        <span className="font-semibold">Worth it?</span> {p.worth_it}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <SourceLink url={fact.transitSourceUrl} />
          </Card>
        )}

        {/* --- Connectivity. */}
        {(fact.localSimNotes || fact.esimSupported !== null) && (
          <Card icon={<Signal size={16} />} title="Staying connected">
            {fact.esimSupported !== null && (
              <p className="font-body text-sm text-ink">
                eSIM: {fact.esimSupported ? "supported" : "not generally supported"}
                {fact.simRegistrationRequired === true && " · SIM registration required"}
              </p>
            )}
            {fact.localSimNotes && (
              <p className="mt-1.5 font-body text-sm text-ink/70">{fact.localSimNotes}</p>
            )}
            {fact.connectivityCost && (
              <p className="mt-1.5 font-body text-xs text-ink/55">{fact.connectivityCost}</p>
            )}
            <SourceLink url={fact.connectivitySourceUrl} />
          </Card>
        )}
      </div>

      {/* --- The full twelve-month reference, in columns so a year of notes
          --- reads as a table rather than an endless single stack. */}
      {isFullYearView && (
        <section className="rounded-panel bg-paper p-5 shadow-paper">
          <h3 className="flex items-center gap-2 font-display text-base text-ink">
            <Thermometer size={16} className="text-ink/35" /> Month by month
          </h3>
          <p className="mt-1 font-body text-xs text-ink/50">
            {fact.climateReferenceCity
              ? `Temperatures and rainfall are national met-service averages for ${fact.climateReferenceCity} — one city, not a national average.`
              : "Temperatures and rainfall are national met-service averages."}{" "}
            {/* Said once here rather than repeated inside all twelve notes: the
                numbers are sourced data, the season call is ours. */}
            The season rating and the crowd notes are our judgement, not measurements.
          </p>
          <div className="mt-4 grid gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
            {climate.map((m) => (
              <div key={m.monthNumber} className="border-t border-line pt-3">
                <MonthHeading month={m} />
                {m.precipitationNote && (
                  <p className="mt-1 font-body text-xs text-ink/60">{m.precipitationNote}</p>
                )}
                {m.crowdNote && (
                  <p className="mt-1 font-body text-xs text-ink/45">{m.crowdNote}</p>
                )}
              </div>
            ))}
          </div>
          <SourceLink url={fact.climateSourceUrl} />
        </section>
      )}

      {/* --- Phrasebook. Curated, not machine-translated — full width because
          --- it reads as a table, not a card. */}
      {fact.phrases.length > 0 && (
        <section className="rounded-panel bg-paper p-5 shadow-paper">
          <h3 className="flex items-center gap-2 font-display text-base text-ink">
            <Languages size={16} className="text-ink/35" /> A few words of{" "}
            {fact.phrasesLanguage ?? "the local language"}
          </h3>
          <p className="mt-1 font-body text-xs text-ink/50">
            {/* Deliberately not "hand-checked" or "verified": most of these lists
                come from a tourism board's own phrase page, but some were
                assembled by the researcher from general language knowledge with
                no citable source. "Curated" is true of all of them; "verified"
                would not be, and the count varies by country. */}
            A short curated list rather than a translation box — {fact.phrases.length} phrases
            you&apos;ll actually reach for.
          </p>
          <dl className="mt-4 grid gap-x-8 gap-y-3 sm:grid-cols-2">
            {fact.phrases.map((p) => (
              <div key={p.id} className="flex items-baseline justify-between gap-3 border-b border-line pb-2">
                <dt className="font-body text-sm text-ink/55">{p.phraseEn}</dt>
                <dd className="shrink-0 text-right">
                  <span className="font-body text-sm font-semibold text-ink">{p.local}</span>
                  {p.romanization && (
                    <span className="block font-body text-xs italic text-ink/45">
                      {p.romanization}
                    </span>
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      )}
    </div>
  );
}
