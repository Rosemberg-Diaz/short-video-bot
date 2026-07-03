import {
  MAX_DURATION_SECONDS,
  MIN_DURATION_SECONDS,
  WORDS_PER_SECOND,
} from "../config/constants";

export function countWords(text: string): number {
  return text.trim().split(/\s+/u).filter(Boolean).length;
}

export function estimateDurationSeconds(text: string): number {
  return Number((countWords(text) / WORDS_PER_SECOND).toFixed(1));
}

export function isValidDuration(text: string): boolean {
  const duration = estimateDurationSeconds(text);
  return duration >= MIN_DURATION_SECONDS && duration <= MAX_DURATION_SECONDS;
}

export function normalizeText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}\s]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

export function slugify(text: string): string {
  return normalizeText(text).replace(/\s+/gu, "-").slice(0, 70);
}

function levenshteinDistance(left: string, right: string): number {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);

  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const substitutionCost =
        left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1;
      current[rightIndex] = Math.min(
        current[rightIndex - 1]! + 1,
        previous[rightIndex]! + 1,
        previous[rightIndex - 1]! + substitutionCost,
      );
    }
    previous.splice(0, previous.length, ...current);
  }

  return previous[right.length]!;
}

function tokenDiceCoefficient(left: string, right: string): number {
  const leftTokens = new Set(normalizeText(left).split(" ").filter(Boolean));
  const rightTokens = new Set(normalizeText(right).split(" ").filter(Boolean));

  if (leftTokens.size === 0 && rightTokens.size === 0) return 1;
  let intersection = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) intersection += 1;
  }

  return (2 * intersection) / (leftTokens.size + rightTokens.size);
}

export function textSimilarity(left: string, right: string): number {
  const normalizedLeft = normalizeText(left);
  const normalizedRight = normalizeText(right);
  if (normalizedLeft === normalizedRight) return 1;

  const maxLength = Math.max(normalizedLeft.length, normalizedRight.length);
  const characterSimilarity =
    maxLength === 0
      ? 1
      : 1 - levenshteinDistance(normalizedLeft, normalizedRight) / maxLength;

  return Math.max(
    characterSimilarity,
    tokenDiceCoefficient(normalizedLeft, normalizedRight),
  );
}
