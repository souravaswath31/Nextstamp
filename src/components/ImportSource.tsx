import { deleteImportSource } from "@/lib/importActions";

type Source = { sourceKind: string; platform: string | null; sourceUrl: string | null; sourceText: string | null };

/**
 * What we kept from the post this trip was drafted from, with a way to delete it.
 * Screenshots are never stored, so for those there is nothing to show or delete
 * and the row only exists as a record that the trip was imported.
 */
export default function ImportSource({ tripId, source }: { tripId: string; source: Source }) {
  const kept = Boolean(source.sourceUrl || source.sourceText);
  return (
    <section className="rounded-panel bg-paper p-6 shadow-paper">
      <h2 className="font-display text-xl text-ink">Drafted from a post</h2>
      <p className="mt-1 font-body text-sm text-ink/60">
        {source.sourceKind === "screenshots"
          ? "This trip was drafted from screenshots. They were read once and not stored."
          : kept
            ? "We kept the link and the public text we read, so you can see where each stop came from. We never stored the video."
            : "The source for this trip has been deleted."}
      </p>
      {source.sourceUrl && (
        <p className="mt-3 break-all font-body text-xs text-ink/55">
          {source.platform ? `${source.platform}: ` : ""}
          {source.sourceUrl}
        </p>
      )}
      {source.sourceText && (
        <details className="mt-3">
          <summary className="cursor-pointer font-body text-xs font-semibold text-coralDark">Text we read</summary>
          <p className="mt-2 max-h-48 overflow-y-auto whitespace-pre-wrap rounded-card bg-paperDark p-3 font-body text-xs text-ink/70">
            {source.sourceText}
          </p>
        </details>
      )}
      {kept && (
        <form action={deleteImportSource.bind(null, tripId)} className="mt-4">
          <button type="submit" className="font-body text-xs font-semibold text-stampRed underline-offset-4 hover:underline">
            Delete the saved source
          </button>
          <span className="ml-2 font-body text-xs text-ink/55">The trip and its stops stay.</span>
        </form>
      )}
    </section>
  );
}
