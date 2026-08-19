import { describe, expect, it } from "vitest";
import {
  CHALLENGE_TYPES,
  generateChallenge,
  getWordBank,
  isAnswerCorrect,
  pickChallengeType,
} from "@/lib/game/challenges";
import { solve } from "@/tests/helpers";

describe("puzzle generators and validators (AC-TEST-008)", () => {
  for (const type of CHALLENGE_TYPES) {
    describe(type, () => {
      it("generates valid payloads without throwing over a repeated sample", () => {
        for (let i = 0; i < 50; i++) {
          const { payload, answer } = generateChallenge(type, "en");
          expect(payload).toBeDefined();
          expect(answer).toBeDefined();
        }
      });

      it("accepts the canonical answer and rejects a wrong one", () => {
        for (let i = 0; i < 30; i++) {
          const { payload, answer } = generateChallenge(type, "en");
          const canonical = solve(payload);
          expect(isAnswerCorrect(type, canonical, answer)).toBe(true);

          const wrong = wrongAnswer(type, payload, canonical);
          expect(isAnswerCorrect(type, wrong, answer)).toBe(false);
        }
      });
    });
  }

  it("word banks have at least 20 words, 5–9 letters, no accents, no duplicates", () => {
    for (const locale of ["en", "it"] as const) {
      const bank = getWordBank(locale);
      expect(bank.length).toBeGreaterThanOrEqual(20);
      const seen = new Set<string>();
      for (const word of bank) {
        expect(word.length).toBeGreaterThanOrEqual(5);
        expect(word.length).toBeLessThanOrEqual(9);
        expect(word.normalize("NFD").replace(/[\u0300-\u036f]/g, "")).toBe(word); // no accents
        expect(/^[a-z]+$/.test(word)).toBe(true);
        expect(seen.has(word)).toBe(false);
        seen.add(word);
      }
    }
  });

  it("word scramble output differs from the correct word and offers four choices", () => {
    for (let i = 0; i < 30; i++) {
      const { payload } = generateChallenge("word-scramble", "en") as {
        payload: { scrambled: string; options: string[] };
      };
      const correct = solve(payload) as string;
      expect(payload.scrambled).not.toBe(correct);
      expect(payload.options).toHaveLength(4);
      expect(payload.options).toContain(correct);
    }
  });

  it("odd-one-out grids have exactly one differing tile", () => {
    for (let i = 0; i < 30; i++) {
      const { payload } = generateChallenge("odd-one-out", "en") as {
        payload: { cols: number; grid: string[] };
      };
      expect(payload.grid.length).toBe(payload.cols * payload.cols);
      const counts = new Map<string, number>();
      for (const glyph of payload.grid) counts.set(glyph, (counts.get(glyph) ?? 0) + 1);
      const frequencies = [...counts.values()];
      expect(frequencies.filter((c) => c === 1)).toHaveLength(1);
    }
  });

  it("memory payloads are 5–8 glyphs with distinguishable buttons", () => {
    for (let i = 0; i < 30; i++) {
      const { payload } = generateChallenge("memory", "en") as {
        payload: { length: number; symbols: string[]; buttons: string[] };
      };
      expect(payload.length).toBeGreaterThanOrEqual(5);
      expect(payload.length).toBeLessThanOrEqual(8);
      expect(payload.symbols).toHaveLength(payload.length);
      expect(payload.buttons.length).toBeGreaterThanOrEqual(2);
      expect(new Set(payload.buttons).size).toBe(payload.buttons.length);
    }
  });

  it("quick-math expressions stay within a mental-math range", () => {
    for (let i = 0; i < 30; i++) {
      const { payload, answer } = generateChallenge("quick-math", "en") as {
        payload: { expression: string };
        answer: number;
      };
      expect(payload.expression).toMatch(/^[\d +−×]+$/);
      expect(answer).toBeGreaterThan(0);
      expect(answer).toBeLessThanOrEqual(200);
    }
  });

  it("does not repeat a puzzle type until the pool is exhausted", () => {
    const used: ReturnType<typeof pickChallengeType>[] = [];
    for (let i = 0; i < CHALLENGE_TYPES.length; i++) {
      const type = pickChallengeType(used);
      expect(used).not.toContain(type);
      used.push(type);
    }
    // Pool exhausted: repetition is allowed again.
    const next = pickChallengeType(used);
    expect(CHALLENGE_TYPES).toContain(next);
  });
});

function wrongAnswer(type: string, payload: unknown, canonical: unknown): unknown {
  const p = payload as {
    options?: unknown[];
    numbers?: number[];
    grid?: string[];
    symbols?: string[];
    buttons?: string[];
  };
  switch (type) {
    case "sequence":
    case "quick-math": {
      const wrongOption = p.options!.find((o) => o !== canonical);
      return wrongOption ?? ((canonical as number) + 1);
    }
    case "odd-one-out": {
      const index = canonical as number;
      return index === 0 ? 1 : 0;
    }
    case "word-scramble":
      return (p.options as string[]).find((o) => o !== canonical)!;
    case "memory": {
      const wrongSequence = [...(canonical as string[])];
      const last = wrongSequence.pop()!;
      wrongSequence.unshift(last);
      return wrongSequence;
    }
    case "order": {
      const wrongOrder = [...(canonical as number[])];
      wrongOrder.reverse();
      return wrongOrder;
    }
    default:
      return null;
  }
}
