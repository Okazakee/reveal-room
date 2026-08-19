"use client";

import { useState } from "react";
import { PuzzleHeader } from "@/components/puzzles/PuzzleHeader";
import type { Messages } from "@/lib/i18n";

export interface OddOneOutPayload {
  type: "odd-one-out";
  cols: 3 | 4;
  grid: string[];
}

interface OddOneOutPuzzleProps {
  payload: OddOneOutPayload;
  index: number;
  total: number;
  busy: boolean;
  onSubmit: (answer: unknown) => Promise<void>;
  t: Messages;
}

/** Find the single tile that differs by shape, not color (RR-22.3, RR-PUZZLE-005). */
export function OddOneOutPuzzle({ payload, index, total, busy, onSubmit, t }: OddOneOutPuzzleProps) {
  const [selected, setSelected] = useState<number | null>(null);

  const submit = (tileIndex: number) => {
    if (busy || selected !== null) return;
    setSelected(tileIndex);
    void onSubmit(tileIndex).finally(() => setSelected(null));
  };

  return (
    <>
      <PuzzleHeader title={t.puzzleOddTitle} instruction={t.puzzleOddInstruction} index={index} total={total} t={t} />
      <div className={`tiles${payload.cols === 4 ? " cols-4" : ""}`}>
        {payload.grid.map((glyph, i) => (
          <button
            key={i}
            type="button"
            className={`tile${selected === i ? " hot" : ""}`}
            disabled={busy}
            onClick={() => submit(i)}
            aria-label={`${t.puzzleOddInstruction} ${i + 1}`}
          >
            {glyph}
          </button>
        ))}
      </div>
    </>
  );
}
