export const DEFAULT_BANNED_WORDS = [
  "bitcoin",
  "crypto",
  "adult",
  "sex",
  "loan",
  "bet",
  "gamble",
  "scam",
];

function collapseWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function normalizeWords(input: string[]): string[] {
  return Array.from(
    new Set(
      (input ?? [])
        .map((word) => collapseWhitespace(String(word ?? "").toLowerCase()))
        .filter(Boolean),
    ),
  );
}

export function findModerationMatches(text: string, words: string[]): string[] {
  const normalizedText = collapseWhitespace(String(text ?? ""));
  if (!normalizedText) return [];

  const normalizedWords = normalizeWords(words);
  const matches: string[] = [];

  for (const word of normalizedWords) {
    const pattern = new RegExp(`\\b${escapeRegExp(word)}\\b`, "i");
    if (pattern.test(normalizedText)) {
      matches.push(word);
    }
  }

  return matches;
}
