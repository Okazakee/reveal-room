import { pickRandom, randomIntInclusive, secureShuffle } from "@/lib/security/tokens";
import type { ChallengeType, Locale } from "@/lib/types";

/**
 * Puzzle engine: generation and server-side answer validation.
 * All six v1 puzzle types are generated here, independently of the secret,
 * and every answer is validated against the canonical server-side value.
 */

export const CHALLENGE_TYPES: readonly ChallengeType[] = [
  "sequence",
  "memory",
  "odd-one-out",
  "quick-math",
  "word-scramble",
  "order",
];

/** Shape glyphs that remain distinguishable without color alone. */
const GLYPH_SET = ["◆", "●", "▲", "■", "★", "✦", "✚", "⬢", "♥", "✖"] as const;

const EN_WORDS = [
  "candle", "mirror", "garden", "pencil", "basket", "rocket", "jacket", "planet",
  "marble", "shadow", "pillow", "camera", "magnet", "meadow", "corner", "castle",
  "summer", "ginger", "pocket", "silver", "bridge", "forest", "cheese", "window",
  "donkey", "yellow", "orange", "kettle", "statue", "island", "flower", "autumn",
  "helmet", "ladder", "button", "violin", "thunder", "kitchen", "journey", "blanket",
  "sunrise", "compass", "library", "mystery", "fashion", "highway", "pumpkin", "station",
  "glacier", "harvest", "mountain", "elephant", "calendar", "diamond", "curtain", "lantern",
  "whistle", "popcorn", "pottery", "tiger", "lemon", "grape", "horse", "sheep",
  "night", "storm", "cloud", "river", "dream", "music", "paper", "sugar",
] as const;

const IT_WORDS = [
  "candela", "specchio", "giardino", "matita", "cesto", "razzo", "giacca", "pianeta",
  "cuscino", "prato", "angolo", "castello", "estate", "zenzero", "tasca", "argento",
  "ponte", "bosco", "formaggio", "finestra", "asino", "giallo", "arancia", "statua",
  "isola", "fiore", "autunno", "elmetto", "scala", "bottone", "violino", "tuono",
  "cucina", "viaggio", "coperta", "bussola", "mistero", "zucca", "stazione", "montagna",
  "elefante", "quaderno", "cappello", "farfalla", "coraggio", "nuvola", "sabbia", "tappeto",
  "lampada", "martello", "funivia", "gabbiano", "castagna", "palazzo", "camicia", "bicchiere",
  "cravatta", "cucchiaio", "poltrona", "ombrello", "giornale", "cerchio", "forchetta", "coltello",
  "piatto", "pioggia", "stella", "cielo", "terra", "fuoco", "vento", "foresta",
  "sedia", "tavolo", "libro", "chiave", "pennello", "limone", "latte", "carne",
  "pesce", "pollo", "anatra", "cavallo", "mucca", "pecora", "gallina", "torre",
  "tetto", "porta", "camera", "salotto", "bagno", "stanza", "gioco", "schermo",
  "sentiero", "strada", "piazza", "vicolo", "portone", "balcone",
] as const;

const WORD_BANK: Record<Locale, readonly string[]> = { en: EN_WORDS, it: IT_WORDS };

export interface GeneratedChallenge {
  payload: unknown;
  answer: unknown;
}

/** Build exactly `count` distinct positive distractors around `correct`. */
function makeDistractorOptions(correct: number, count: number): number[] {
  const deltas = secureShuffle([1, 2, 3, 4, 5, 6, 7, -1, -2, -3, -4, -5, -6, -7]);
  const options: number[] = [correct];
  for (const delta of deltas) {
    if (options.length >= count + 1) break;
    const candidate = correct + delta;
    if (candidate <= 0 || options.includes(candidate)) continue;
    options.push(candidate);
  }
  return secureShuffle(options);
}

function generateSequence(): GeneratedChallenge {
  const family = pickRandom(["add", "sub", "mul", "alt"] as const);
  let terms: number[];
  let next: number;
  switch (family) {
    case "add": {
      const a0 = randomIntInclusive(1, 25);
      const step = randomIntInclusive(2, 9);
      terms = [a0, a0 + step, a0 + 2 * step, a0 + 3 * step];
      next = a0 + 4 * step;
      break;
    }
    case "sub": {
      const step = randomIntInclusive(2, 9);
      const a0 = randomIntInclusive(4 * step + 1, 90);
      terms = [a0, a0 - step, a0 - 2 * step, a0 - 3 * step];
      next = a0 - 4 * step;
      break;
    }
    case "mul": {
      const a0 = randomIntInclusive(2, 6);
      const factor = randomIntInclusive(2, 5);
      terms = [a0, a0 * factor, a0 * factor * factor, a0 * factor * factor * factor];
      next = a0 * factor ** 4;
      break;
    }
    case "alt": {
      const x = randomIntInclusive(1, 20);
      let y = randomIntInclusive(1, 20);
      while (y === x) y = randomIntInclusive(1, 20);
      terms = [x, y, x, y, x];
      next = y;
      break;
    }
  }
  return { payload: { type: "sequence", terms, options: makeDistractorOptions(next, 4) }, answer: next };
}

function generateMemory(): GeneratedChallenge {
  const length = randomIntInclusive(5, 8);
  const symbols: string[] = [];
  for (let i = 0; i < length; i++) symbols.push(pickRandom(GLYPH_SET));
  const buttons: string[] = [];
  for (const symbol of symbols) if (!buttons.includes(symbol)) buttons.push(symbol);
  return { payload: { type: "memory", length, symbols, buttons }, answer: symbols };
}

function generateOddOneOut(): GeneratedChallenge {
  const cols = pickRandom([3, 4]);
  const count = cols * cols;
  const base = pickRandom(GLYPH_SET);
  let diff = pickRandom(GLYPH_SET);
  while (diff === base) diff = pickRandom(GLYPH_SET);
  const target = randomIntInclusive(0, count - 1);
  const grid: string[] = [];
  for (let i = 0; i < count; i++) grid.push(i === target ? diff : base);
  return { payload: { type: "odd-one-out", cols, grid }, answer: target };
}

function generateQuickMath(): GeneratedChallenge {
  const form = pickRandom(["a+b", "a-b", "a×b", "a×b+c", "a×b-c"] as const);
  let expression: string;
  let result: number;
  switch (form) {
    case "a+b": {
      const a = randomIntInclusive(1, 30);
      const b = randomIntInclusive(1, 30);
      expression = `${a} + ${b}`;
      result = a + b;
      break;
    }
    case "a-b": {
      const b = randomIntInclusive(1, 49);
      const a = randomIntInclusive(b + 1, 50);
      expression = `${a} − ${b}`;
      result = a - b;
      break;
    }
    case "a×b": {
      const a = randomIntInclusive(2, 12);
      const b = randomIntInclusive(2, 9);
      expression = `${a} × ${b}`;
      result = a * b;
      break;
    }
    case "a×b+c": {
      const a = randomIntInclusive(2, 9);
      const b = randomIntInclusive(2, 9);
      const c = randomIntInclusive(1, 9);
      expression = `${a} × ${b} + ${c}`;
      result = a * b + c;
      break;
    }
    case "a×b-c": {
      const a = randomIntInclusive(2, 9);
      const b = randomIntInclusive(2, 9);
      const c = randomIntInclusive(1, a * b - 1);
      expression = `${a} × ${b} − ${c}`;
      result = a * b - c;
      break;
    }
  }
  return { payload: { type: "quick-math", expression, options: makeDistractorOptions(result, 4) }, answer: result };
}

function scrambleWord(word: string): string | null {
  for (let attempt = 0; attempt < 20; attempt++) {
    const shuffled = secureShuffle(word.split("")).join("");
    if (shuffled !== word) return shuffled;
  }
  return null;
}

function generateWordScramble(locale: Locale): GeneratedChallenge {
  const bank = WORD_BANK[locale];
  for (let attempt = 0; attempt < 10; attempt++) {
    const correct = pickRandom(bank);
    const scrambled = scrambleWord(correct);
    if (scrambled === null) continue;
    const distractors = secureShuffle([...bank]).filter((w) => w !== correct).slice(0, 3);
    return {
      payload: { type: "word-scramble", scrambled, options: secureShuffle([correct, ...distractors]) },
      answer: correct,
    };
  }
  // Word bank is large; failure is effectively impossible.
  throw new Error("word-scramble generation failed");
}

function generateOrder(): GeneratedChallenge {
  const numbers: number[] = [];
  while (numbers.length < 5) {
    const n = randomIntInclusive(1, 50);
    if (!numbers.includes(n)) numbers.push(n);
  }
  const answer = [...numbers].sort((a, b) => a - b);
  return { payload: { type: "order", numbers: secureShuffle(numbers) }, answer };
}

/** Generate a puzzle of the given type, independent of the secret. */
export function generateChallenge(type: ChallengeType, locale: Locale): GeneratedChallenge {
  switch (type) {
    case "sequence":
      return generateSequence();
    case "memory":
      return generateMemory();
    case "odd-one-out":
      return generateOddOneOut();
    case "quick-math":
      return generateQuickMath();
    case "word-scramble":
      return generateWordScramble(locale);
    case "order":
      return generateOrder();
  }
}

/**
 * Choose the next puzzle type without repeating one until the pool is
 * exhausted. `usedTypes` is the room's per-game history.
 */
export function pickChallengeType(usedTypes: readonly ChallengeType[]): ChallengeType {
  const used = new Set(usedTypes);
  const unused = CHALLENGE_TYPES.filter((t) => !used.has(t));
  const pool = unused.length > 0 ? unused : CHALLENGE_TYPES;
  return pickRandom(pool);
}

/** Compare a submitted answer against the canonical answer. */
export function isAnswerCorrect(type: ChallengeType, answer: unknown, canonical: unknown): boolean {
  switch (type) {
    case "sequence":
    case "quick-math":
    case "odd-one-out":
      return typeof answer === "number" && answer === canonical;
    case "word-scramble":
      return typeof answer === "string" && answer === canonical;
    case "memory":
    case "order":
      return (
        Array.isArray(answer) &&
        Array.isArray(canonical) &&
        answer.length === canonical.length &&
        answer.every((v, i) => v === canonical[i])
      );
  }
}

/** The locale-specific word bank used by word-scramble (RR-I18N-005). */
export function getWordBank(locale: Locale): readonly string[] {
  return WORD_BANK[locale];
}
