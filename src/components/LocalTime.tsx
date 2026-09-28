"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { jetLagNote, readZone, type ZoneReading } from "@/lib/timezones";

/**
 * "What time is it there, and how far is that from me."
 *
 * The second half of that question can only be answered in the browser — the
 * server has no idea what timezone the reader is in, and guessing from its own
 * would be wrong for almost everyone. So the zone label renders on the server
 * and the comparison appears after mount, rather than risking a hydration
 * mismatch by reading Intl during render.
 */
export default function LocalTime({
  zone,
  label,
  note,
}: {
  zone: string;
  label: string;
  note?: string | null;
}) {
  const [reading, setReading] = useState<ZoneReading | null>(null);

  useEffect(() => {
    const viewerZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    const tick = () => setReading(readZone(zone, viewerZone));
    tick();
    // A minute is the finest granularity this display shows, so there's no
    // reason to re-render more often than that.
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [zone]);

  const lag = reading ? jetLagNote(reading.offsetMinutesFromViewer) : null;

  return (
    <div className="rounded-card bg-paperDark px-4 py-3.5">
      <p className="flex items-center gap-1.5 font-stamp text-[11px] uppercase tracking-wide text-ink/45">
        <Clock size={12} /> Local time
      </p>
      {reading ? (
        <>
          <p className="mt-1.5 font-display text-2xl tabular-nums text-ink">{reading.localTime}</p>
          <p className="font-body text-xs text-ink/55">
            {reading.localDate}
            {reading.abbreviation ? ` · ${reading.abbreviation}` : ""}
          </p>
          <p className="mt-1 font-body text-xs font-semibold text-teal">
            {reading.relativeToViewer}
          </p>
        </>
      ) : (
        <p className="mt-1.5 font-body text-sm text-ink/70">{label}</p>
      )}
      {note && <p className="mt-2 font-body text-xs text-ink/50">{note}</p>}
      {lag && <p className="mt-2 font-body text-xs text-ink/50">{lag}</p>}
    </div>
  );
}
