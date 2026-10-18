/** "a" or "an" for the word that follows ("an Australia visa", "a UK visa"). */
export function aOrAn(word: string): "a" | "an" {
  const w = word.trim();
  // Initialisms read by letter name: "UK" -> "a", "US" -> "a", "UAE" -> "a" (you-ay-ee), "SA" -> "an" is not used here.
  if (/^(US|UK|UAE)\b/.test(w)) return "a";
  return /^[aeiou]/i.test(w) ? "an" : "a";
}
