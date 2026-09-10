const phraseHints =
  /\b(somos|somos\s+\d|traemos|presupuesto|pesos|\$|sin\s|para\s+\d|quiero|queremos|algo\s)/i;

/** True when the query looks like a natural-language order phrase (worth AI intent). */
export function looksLikePhrase(text: string): boolean {
  const words = text.trim().split(/\s+/).filter(Boolean);
  return words.length >= 4 || phraseHints.test(text);
}
