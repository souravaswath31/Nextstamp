"use client";

import { useId, useRef, useState, useTransition } from "react";
import { Link2, FileText, Image as ImageIcon, MapPin, MapPinOff, Quote, Sparkles } from "lucide-react";
import { createTripFromImport } from "@/lib/importActions";
import type { DraftStop, DraftTrip } from "@/lib/tripImport/plan";

type Mode = "link" | "text" | "screenshots";

const TABS: { mode: Mode; label: string; icon: typeof Link2 }[] = [
  { mode: "link", label: "Link", icon: Link2 },
  { mode: "text", label: "Paste caption", icon: FileText },
  { mode: "screenshots", label: "Screenshots", icon: ImageIcon },
];

const MAX_IMAGES = 4;

/** Shrinks a screenshot in the browser so four of them fit comfortably in one upload. */
async function shrink(file: File): Promise<File> {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext("2d")?.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob: Blob | null = await new Promise((r) => canvas.toBlob(r, "image/jpeg", 0.82));
    return blob ? new File([blob], "screenshot.jpg", { type: "image/jpeg" }) : file;
  } catch {
    return file;
  }
}

export default function TripImporter() {
  const uid = useId();
  const [mode, setMode] = useState<Mode>("link");
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ importId: string; draft: DraftTrip } | null>(null);

  async function analyze(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const fd = new FormData();
      fd.set("mode", mode);
      if (mode === "link") fd.set("url", url);
      if (mode === "text") fd.set("text", text);
      if (mode === "screenshots") {
        for (const f of await Promise.all(files.map(shrink))) fd.append("images", f);
      }
      const res = await fetch("/api/trip-import/analyze", { method: "POST", body: fd });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        setError(json?.error ?? "Something went wrong. Try again.");
        return;
      }
      setResult({ importId: json.importId, draft: json.draft });
    } catch {
      setError("We couldn't reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  if (result) return <Review importId={result.importId} draft={result.draft} onBack={() => setResult(null)} />;

  return (
    <form onSubmit={analyze} className="space-y-5">
      <div role="tablist" aria-label="How to import" className="flex flex-wrap gap-2">
        {TABS.map(({ mode: m, label, icon: Icon }) => (
          <button
            key={m}
            type="button"
            role="tab"
            id={`${uid}-tab-${m}`}
            aria-selected={mode === m}
            aria-controls={`${uid}-panel`}
            onClick={() => { setMode(m); setError(null); }}
            className={`flex items-center gap-2 rounded-full border px-4 py-2 font-body text-sm transition-colors ${
              mode === m ? "border-coral bg-coral/15 text-white" : "border-white/15 text-white/65 hover:border-white/30"
            }`}
          >
            <Icon size={15} aria-hidden="true" /> {label}
          </button>
        ))}
      </div>

      <div id={`${uid}-panel`} role="tabpanel" aria-labelledby={`${uid}-tab-${mode}`} className="space-y-2">
        {mode === "link" && (
          <>
            <label htmlFor={`${uid}-url`} className="font-body text-sm text-white/70">
              Link to a public YouTube, TikTok or Instagram post
            </label>
            <input
              id={`${uid}-url`}
              type="url"
              inputMode="url"
              required
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=…"
              className="w-full rounded-full border border-white/15 bg-white/[0.06] px-5 py-3 font-body text-sm text-white placeholder:text-white/55 focus:border-coral focus:outline-none focus-visible:ring-2 focus-visible:ring-coral/50"
            />
            <p className="font-body text-xs text-white/55">
              We read only what the platform shares publicly. If it won&apos;t share the caption, you&apos;ll be asked to paste it instead.
            </p>
          </>
        )}
        {mode === "text" && (
          <>
            <label htmlFor={`${uid}-text`} className="font-body text-sm text-white/70">
              The caption, description or comments that name the places
            </label>
            <textarea
              id={`${uid}-text`}
              required
              rows={7}
              maxLength={8000}
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="w-full rounded-card border border-white/15 bg-white/[0.06] px-4 py-3 font-body text-sm text-white placeholder:text-white/55 focus:border-coral focus:outline-none focus-visible:ring-2 focus-visible:ring-coral/50"
            />
          </>
        )}
        {mode === "screenshots" && <ScreenshotPicker id={`${uid}-files`} files={files} setFiles={setFiles} />}
      </div>

      {error && <p role="alert" className="rounded-card bg-stampRed/15 px-4 py-3 font-body text-sm text-bone">{error}</p>}

      <button
        type="submit"
        disabled={busy || (mode === "screenshots" && files.length === 0)}
        className="btn-pill btn-pill-accent disabled:opacity-60"
      >
        {busy ? "Reading the post…" : "Find the places"}
      </button>
      <p className="font-body text-xs text-white/55">
        Uses an AI model to read the post. Nothing is saved as a trip until you review the places and confirm.
      </p>
    </form>
  );
}

function ScreenshotPicker({ id, files, setFiles }: { id: string; files: File[]; setFiles: (f: File[]) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <label htmlFor={id} className="font-body text-sm text-white/70">
        Up to {MAX_IMAGES} screenshots of the post
      </label>
      <input
        ref={ref}
        id={id}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        onChange={(e) => setFiles(Array.from(e.target.files ?? []).slice(0, MAX_IMAGES))}
        className="block w-full font-body text-sm text-white/70 file:mr-4 file:rounded-full file:border-0 file:bg-white/10 file:px-4 file:py-2 file:text-white"
      />
      {files.length > 0 && (
        <p className="font-body text-xs text-white/55">
          {files.length} selected. Screenshots are read once and never stored.
        </p>
      )}
    </>
  );
}

function Review({ importId, draft, onBack }: { importId: string; draft: DraftTrip; onBack: () => void }) {
  const [title, setTitle] = useState(draft.title);
  const [kept, setKept] = useState<Set<string>>(
    () => new Set(draft.stops.filter((s) => s.origin === "post").map((s) => s.id))
  );
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const titleId = useId();

  const fromPost = draft.stops.filter((s) => s.origin === "post");
  const suggested = draft.stops.filter((s) => s.origin === "suggested");
  const byId = new Map(draft.stops.map((s) => [s.id, s]));

  function toggle(id: string) {
    setKept((k) => {
      const n = new Set(k);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  function create() {
    setError(null);
    start(async () => {
      const chosen = draft.stops.filter((s) => kept.has(s.id));
      const res = await createTripFromImport(
        importId,
        JSON.stringify({ title, destinationCountry: draft.destinationCountry, stops: chosen })
      );
      if (res && "error" in res) setError(res.error);
    });
  }

  return (
    <div className="space-y-8">
      <div>
        <label htmlFor={titleId} className="font-body text-sm text-white/70">Trip name</label>
        <input
          id={titleId}
          value={title}
          maxLength={80}
          onChange={(e) => setTitle(e.target.value)}
          className="mt-1 w-full rounded-full border border-white/15 bg-white/[0.06] px-5 py-3 font-body text-sm text-white focus:border-coral focus:outline-none focus-visible:ring-2 focus-visible:ring-coral/50"
        />
      </div>

      <section aria-labelledby={`${titleId}-post`}>
        <h3 id={`${titleId}-post`} className="font-display text-xl text-white">From the post</h3>
        <p className="mt-1 font-body text-sm text-white/55">
          Places the post names. Untick any that don&apos;t belong.
        </p>
        <ul className="mt-4 space-y-2">
          {fromPost.map((s) => <StopRow key={s.id} stop={s} checked={kept.has(s.id)} onToggle={() => toggle(s.id)} />)}
        </ul>
      </section>

      {suggested.length > 0 && (
        <section aria-labelledby={`${titleId}-sug`}>
          <h3 id={`${titleId}-sug`} className="font-display text-xl text-white">Suggested by NextStamp</h3>
          <p className="mt-1 font-body text-sm text-white/55">
            Not in the post. These are places from our own guide for the same state. Tick any you want saved with the trip.
          </p>
          <ul className="mt-4 space-y-2">
            {suggested.map((s) => <StopRow key={s.id} stop={s} checked={kept.has(s.id)} onToggle={() => toggle(s.id)} />)}
          </ul>
        </section>
      )}

      <section aria-labelledby={`${titleId}-order`} className="rounded-card border border-white/10 bg-white/[0.04] p-5">
        <h3 id={`${titleId}-order`} className="font-display text-xl text-white">Order and drive times</h3>
        {draft.ordering.kind === "ordered" ? (
          <ol className="mt-3 space-y-2 font-body text-sm text-white/80">
            {draft.ordering.days.map((d, i) => (
              <li key={i}>
                <span className="font-semibold text-white">Day {i + 1}</span>{" "}
                {d.stopIds.map((id) => byId.get(id)?.name).filter(Boolean).join(" → ")}
                {d.drive && <span className="text-white/55"> · about {d.drive} driving</span>}
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-3 font-body text-sm text-white/70">Stops are shown unordered. {draft.ordering.reason}</p>
        )}
        {draft.notes.map((n) => (
          <p key={n} className="mt-3 font-body text-xs text-white/55">{n}</p>
        ))}
        <p className="mt-3 font-body text-xs text-white/55">
          If you untick stops, the order is worked out again when you create the trip.
        </p>
      </section>

      {error && <p role="alert" className="rounded-card bg-stampRed/15 px-4 py-3 font-body text-sm text-bone">{error}</p>}

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={create} disabled={pending || kept.size === 0} className="btn-pill btn-pill-accent disabled:opacity-60">
          {pending ? "Creating…" : `Create trip with ${kept.size} stop${kept.size === 1 ? "" : "s"}`}
        </button>
        <button type="button" onClick={onBack} disabled={pending} className="font-body text-sm text-white/60 underline-offset-4 hover:text-white hover:underline">
          Start over
        </button>
      </div>
    </div>
  );
}

function StopRow({ stop, checked, onToggle }: { stop: DraftStop; checked: boolean; onToggle: () => void }) {
  const id = useId();
  const placed = stop.lat !== null && stop.lng !== null;
  return (
    <li className="rounded-card border border-white/10 bg-white/[0.04] px-4 py-3">
      <div className="flex items-start gap-3">
        <input id={id} type="checkbox" checked={checked} onChange={onToggle} className="mt-1 h-4 w-4 accent-coral" />
        <label htmlFor={id} className="min-w-0 flex-1 cursor-pointer">
          <span className="flex flex-wrap items-center gap-2 font-body text-sm font-semibold text-white">
            {stop.name}
            {stop.origin === "post" ? (
              <span className="rounded-full bg-forest/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-bone">From the post</span>
            ) : (
              <span className="flex items-center gap-1 rounded-full bg-teal/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-bone">
                <Sparkles size={10} aria-hidden="true" /> Suggested by NextStamp
              </span>
            )}
          </span>
          {stop.quote && (
            <span className="mt-1 flex items-start gap-1.5 font-body text-xs text-white/55">
              <Quote size={11} className="mt-0.5 shrink-0" aria-hidden="true" /> {stop.quote}
            </span>
          )}
          <span className="mt-1 flex items-center gap-1 font-body text-xs text-white/55">
            {placed ? <MapPin size={11} aria-hidden="true" /> : <MapPinOff size={11} aria-hidden="true" />}
            {placed
              ? stop.locatedBy === "guide" ? "On the map, from our guide" : "On the map, from a place lookup"
              : "Couldn't be placed on the map with confidence"}
          </span>
        </label>
      </div>
    </li>
  );
}
