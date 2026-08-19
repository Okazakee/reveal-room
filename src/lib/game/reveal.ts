import { toGraphemes, isWhitespace } from "@/lib/api/validation";
import { secureShuffle } from "@/lib/security/tokens";
import type { RevealMode } from "@/lib/types";

export interface SecretParts {
  graphemes: string[];
  /** Indexes into `graphemes` of non-whitespace (maskable) graphemes. */
  maskableIndexes: number[];
}

export const MASK_CHAR = "•";

export function splitSecret(secret: string): SecretParts {
  const graphemes = toGraphemes(secret);
  const maskableIndexes: number[] = [];
  for (let i = 0; i < graphemes.length; i++) {
    if (!isWhitespace(graphemes[i]!)) maskableIndexes.push(i);
  }
  return { graphemes, maskableIndexes };
}

/**
 * The cryptographically shuffled reveal order over maskable grapheme
 * positions. Stored server-side only; never sent to clients.
 */
export function createRevealOrder(secret: string): number[] {
  const { maskableIndexes } = splitSecret(secret);
  return secureShuffle(maskableIndexes);
}

/**
 * Number of maskable graphemes that must be revealed after challenge number
 * `completedChallenges` (1-based) out of `total`.
 *
 * Progressive: ceil(maskableCount * i / N) — distributes reveals as evenly as
 * possible and always reveals everything at the final challenge.
 * Final: zero until the last challenge, then everything.
 */
export function revealTarget(
  mode: RevealMode,
  completedChallenges: number,
  total: number,
  maskableCount: number,
): number {
  if (maskableCount === 0) return 0;
  if (completedChallenges >= total) return maskableCount;
  if (mode === "final") return 0;
  return Math.ceil((maskableCount * completedChallenges) / total);
}

/**
 * Render the masked display string: whitespace preserved, revealed graphemes
 * shown, everything else a bullet. One output char per input grapheme keeps
 * the display width stable as masks are replaced.
 */
export function renderMasked(secret: string, revealOrder: number[], revealedCount: number): string {
  const { graphemes } = splitSecret(secret);
  const revealed = new Set(revealOrder.slice(0, revealedCount));
  let out = "";
  for (let i = 0; i < graphemes.length; i++) {
    const grapheme = graphemes[i]!;
    if (revealed.has(i) || isWhitespace(grapheme)) out += grapheme;
    else out += MASK_CHAR;
  }
  return out;
}

export function isFullyRevealed(secret: string, revealOrder: number[], revealedCount: number): boolean {
  const { maskableIndexes } = splitSecret(secret);
  return revealedCount >= maskableIndexes.length;
}
