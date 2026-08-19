"use client";

import { useState } from "react";
import { PuzzleHeader } from "@/components/puzzles/PuzzleHeader";
import type { Messages } from "@/lib/i18n";

export interface QuickMathPayload {
  type: "quick-math";
  expression: string;
  options: number[];
}

interface QuickMathPuzzleProps {
  payload: QuickMathPayload;
  index: number;
  total: number;
  busy: boolean;
  onSubmit: (answer: unknown) => Promise<void>;
  t: Messages;
}

/** Small mental-math expression with four choices (RR-22.4). */
export function QuickMathPuzzle({ payload, index, total, busy, onSubmit, t }: QuickMathPuzzleProps) {
  const [selected, setSelected] = useState<number | null>(null);

  const submit = (value: number) => {
    if (busy || selected !== null) return;
    setSelected(value);
    void onSubmit(value).finally(() => setSelected(null));
  };

  return (
    <>
      <PuzzleHeader title={t.puzzleMathTitle} instruction={t.puzzleMathInstruction} index={index} total={total} t={t} />
      <div className="challenge">
        <h4 className="math">{payload.expression}</h4>
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
