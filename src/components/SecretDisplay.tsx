"use client";

import { useMemo } from "react";

export const MASK_CHAR = "•";

let clientSegmenter: Intl.Segmenter | undefined;

function graphemes(value: string): string[] {
  clientSegmenter ??= new Intl.Segmenter(undefined, { granularity: "grapheme" });
  return [...clientSegmenter.segment(value)].map((s) => s.segment);
}

interface SecretDisplayProps {
  label: string;
  masked: string;
  className?: string;
}

/**
 * Signature component (RR-VIS-010): dark bordered card, tiny uppercase label,
 * monospace secret. Revealed graphemes get accent emphasis, masks stay
 * subdued gray, whitespace/newlines are preserved exactly, and the mask→
 * grapheme swap is 1:1 per grapheme so the layout never jumps.
 *
 * Note: a literal "•" inside a secret is indistinguishable from a mask by
 * design; it is rendered as-is, which is cosmetically acceptable and has no
 * security impact (the character itself is the revealed content).
 */
export function SecretDisplay({ label, masked, className = "" }: SecretDisplayProps) {
  const parts = useMemo(() => graphemes(masked), [masked]);

  return (
    <div className={`secret-card ${className}`}>
      <div className="label">{label}</div>
      <div className="secret" key={masked}>
        {parts.map((grapheme, index) => {
          const isWhitespace = grapheme.trim() === "";
          const isMasked = !isWhitespace && grapheme === MASK_CHAR;
          return (
            <span key={index} className={isMasked ? "mask" : "rev"}>
              {grapheme}
            </span>
          );
        })}
      </div>
    </div>
  );
}
