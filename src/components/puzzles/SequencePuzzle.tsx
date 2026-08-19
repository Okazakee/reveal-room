"use client";

import { useState } from "react";
import { PuzzleHeader } from "@/components/puzzles/PuzzleHeader";
import type { Messages } from "@/lib/i18n";

export interface SequencePayload {
  type: "sequence";
  terms: number[];
  options: number[];
}

interface SequencePuzzleProps {
  payload: SequencePayload;
  index: number;
  total: number;
  busy: boolean;
  onSubmit: (answer: unknown) => Promise<void>;
  t: Messages;
}

/** Number sequence: pick the next value from four options (RR-22.1). */
export function SequencePuzzle({ payload, index, total, busy, onSubmit, t }: SequencePuzzleProps) {
  const [selected, setSelected] = useState<number | null>(null);

  const submit = (value: number) => {
    if (busy || selected !== null) return;
    setSelected(value);
    void onSubmit(value).finally(() => setSelected(null));
  };

  return (
    <>
      <PuzzleHeader title={t.puzzleSequenceTitle} instruction={t.puzzleSequenceInstruction} index={index} total={total} t={t} />
      <div className="order-tiles" style={{ marginTop: 26 }}>
        {payload.terms.map((term, i) => (
          <div key={i} className="tile" style={{ cursor: "default", width: 56 }}>
            {term}
          </div>
        ))}
      </div>
      <div className="choices">
        {payload.options.map((option) => (
          <button
            key={option}
            type="button"
            className={`choice${selected === option ? " hot" : ""}`}
            disabled={busy}
            onClick={() => submit(option)}
          >
            {option}
          </button>
        ))}
      </div>
    </>
  );
}
