import { CloudSun, Info } from "lucide-react";
import { formatForecastDate, type WeatherOutlook } from "@/lib/weather";
import { CLIMATE_RATING_CLASSES, CLIMATE_RATING_LABELS } from "@/lib/countryFacts";

// Renders whichever of the two answers weather.ts could honestly give: a real
// forecast when the trip is close enough for one to exist, or the destination's
// month-by-month normals when it isn't. The distinction is made explicit in the
// copy rather than dressed up — "averages for March" and "Tuesday will be 14°"
// are very different promises.

export default function WeatherPanel({ outlook }: { outlook: WeatherOutlook }) {
  if (!outlook) return null;

  if (outlook.kind === "forecast") {
    return (
      <section className="rounded-panel bg-paper p-5 shadow-paper">
        <h3 className="flex items-center gap-2 font-display text-base text-ink">
          <CloudSun size={16} className="text-ink/35" /> Forecast for your dates
        </h3>
        <p className="mt-1 font-body text-xs text-ink/50">
          {outlook.location ? `${outlook.location}. ` : ""}A real forecast, so it only exists
          this close to departure — it will sharpen as the days approach.
        </p>
        <div className="mt-4 flex gap-3 overflow-x-auto pb-1">
          {outlook.days.map((d) => (
            <div
              key={d.date}
              className="min-w-[7.5rem] shrink-0 rounded-card bg-paperDark px-3.5 py-3 text-center"
            >
              <p className="font-stamp text-[11px] uppercase tracking-wide text-ink/45">
                {formatForecastDate(d.date)}
              </p>
              {d.iconUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={d.iconUrl} alt="" className="mx-auto mt-1 h-10 w-10" />
              )}
              <p className="mt-0.5 font-display text-lg tabular-nums text-ink">
                {d.maxC}° <span className="text-ink/40">/ {d.minC}°</span>
              </p>
              <p className="mt-0.5 font-body text-[11px] leading-tight text-ink/60">
                {d.conditionText}
              </p>
              {d.chanceOfRain !== null && d.chanceOfRain > 0 && (
                <p className="mt-1 font-body text-[11px] text-teal">{d.chanceOfRain}% rain</p>
              )}
            </div>
          ))}
        </div>
        <p className="mt-3 font-body text-[11px] text-ink/35">Forecast data from WeatherAPI.com.</p>
      </section>
    );
  }

  return (
    <section className="rounded-panel bg-paper p-5 shadow-paper">
      <h3 className="flex items-center gap-2 font-display text-base text-ink">
        <CloudSun size={16} className="text-ink/35" /> What the weather is usually like
      </h3>
      <p className="mt-1 flex items-start gap-1.5 font-body text-xs text-ink/50">
        <Info size={12} className="mt-0.5 shrink-0" />
        <span>
          Your dates are too far out for a forecast to mean anything, so these are long-run
          averages from the national meteorological service
          {outlook.referenceCity ? ` for ${outlook.referenceCity}` : ""} — what to expect, not
          what will happen.
        </span>
      </p>
      <ul className="mt-3 space-y-3">
        {outlook.months.map((m) => (
          <li key={m.monthNumber}>
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
            {m.precipitationNote && (
              <p className="mt-0.5 font-body text-xs text-ink/60">{m.precipitationNote}</p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
