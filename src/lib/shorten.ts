/**
 * Splits long explanatory text into a short lead and the rest, so a page can show the point first
 * and keep the full wording one click away. Cuts at a sentence end near `max` characters; text that
 * is only a little over the limit is left whole, because hiding one sentence is not worth a button.
 */
export function splitSummary(text: string, max = 240): { short: string; rest: string } {
  const t = text.trim();
  if (t.length <= max * 1.3) return { short: t, rest: "" };
  const window = t.slice(0, max + 80);
  // last sentence end at or before max+80, but not so early that the lead is a fragment
  let cut = -1;
  for (const m of window.matchAll(/[.!?](?=\s)/g)) {
    if (m.index !== undefined && m.index + 1 >= 80 && m.index + 1 <= max + 80) cut = m.index + 1;
  }
  if (cut === -1) {
    const sp = t.lastIndexOf(" ", max);
    cut = sp > 40 ? sp : max;
    return { short: t.slice(0, cut).trimEnd() + "…", rest: t.slice(cut).trimStart() };
  }
  return { short: t.slice(0, cut), rest: t.slice(cut).trimStart() };
}
