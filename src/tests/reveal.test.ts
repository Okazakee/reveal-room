import { describe, expect, it } from "vitest";
import {
  createRevealOrder,
  isFullyRevealed,
  MASK_CHAR,
  renderMasked,
  revealTarget,
  splitSecret,
} from "@/lib/game/reveal";

describe("grapheme segmentation", () => {
  it("splits into graphemes and marks only non-whitespace as maskable", () => {
    const { graphemes, maskableIndexes } = splitSecret("AB C\nD");
    expect(graphemes.join("")).toBe("AB C\nD");
    expect(maskableIndexes).toEqual([0, 1, 3, 5]);
  });

  it("treats ZWJ emoji families as a single grapheme", () => {
    const family = "\u{1F468}\u200D\u{1F469}\u200D\u{1F467}"; // 👨‍👩‍👧
    const { graphemes, maskableIndexes } = splitSecret(`${family}X`);
    expect(graphemes).toHaveLength(2);
    expect(maskableIndexes).toEqual([0, 1]);
  });

  it("treats combining marks as a single grapheme", () => {
    const eAcute = "e\u0301";
    const { graphemes } = splitSecret(eAcute);
    expect(graphemes).toHaveLength(1);
  });
});

describe("reveal masking (AC-TEST-003)", () => {
  it("masks every non-whitespace grapheme while preserving whitespace exactly", () => {
    const secret = "ABCD-1234\nSee you there";
    const order = createRevealOrder(secret);
    const masked = renderMasked(secret, order, 0);
    expect(masked).toBe("•••••••••\n••• ••• •••••");
    expect(masked).toContain("\n");
    expect(masked).toContain(" ");
  });

  it("reveals the requested number of maskable graphemes", () => {
    const secret = "ABCD";
    const order = createRevealOrder(secret);
    const masked1 = renderMasked(secret, order, 1);
    const revealed = [...masked1].filter((ch) => ch !== MASK_CHAR);
    expect(revealed).toHaveLength(1);
    expect("ABCD").toContain(revealed[0]);
  });

  it("progressive checkpoints are monotonic and end fully revealed", () => {
    const { maskableIndexes } = splitSecret("ABCDEFGHIJ");
    const count = maskableIndexes.length;
    let previous = 0;
    for (let i = 1; i <= 5; i++) {
      const target = revealTarget("progressive", i, 5, count);
      expect(target).toBeGreaterThanOrEqual(previous);
      previous = target;
    }
    expect(revealTarget("progressive", 5, 5, count)).toBe(count);
  });

  it("final-only mode reveals zero until the last challenge, then everything", () => {
    const count = 10;
    for (let i = 1; i < 5; i++) {
      expect(revealTarget("final", i, 5, count)).toBe(0);
    }
    expect(revealTarget("final", 5, 5, count)).toBe(count);
  });

  it("handles emoji secrets without splitting them", () => {
    const secret = "🎉🎉🎊";
    const order = createRevealOrder(secret);
    expect(renderMasked(secret, order, 0)).toBe("•••");
    expect(renderMasked(secret, order, 1)).not.toBe("•••");
    expect(renderMasked(secret, order, 3)).toBe(secret);
    expect(isFullyRevealed(secret, order, 3)).toBe(true);
    expect(isFullyRevealed(secret, order, 2)).toBe(false);
  });

  it("reveals the full secret at completion in both modes", () => {
    const secret = "A7K2-P9WM-7QL89";
    const order = createRevealOrder(secret);
    const count = splitSecret(secret).maskableIndexes.length;
    expect(renderMasked(secret, order, count)).toBe(secret);
    expect(isFullyRevealed(secret, order, count)).toBe(true);
  });

  it("single-character secrets reveal fully on the first challenge", () => {
    const secret = "x";
    const order = createRevealOrder(secret);
    expect(revealTarget("progressive", 1, 5, 1)).toBe(1);
    expect(renderMasked(secret, order, 1)).toBe("x");
  });
});
