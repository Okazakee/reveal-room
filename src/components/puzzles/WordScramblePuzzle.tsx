"use client";

import { useState } from "react";
import { PuzzleHeader } from "@/components/puzzles/PuzzleHeader";
import type { Messages } from "@/lib/i18n";

export interface WordScramblePayload {
  type: "word-scramble";
  scrambled: string;
  options: string[];
}

interface WordScramblePuzzleProps {
  payload: WordScramblePayload;
  index: number;
  total: number;
  busy: boolean;
  onSubmit: (answer: unknown) => Promise<void>;
  t: Messages;
}

/** Unscramble the word, four answer choices (RR-22.5). */
export function WordScramblePuzzle({ payload, index, total, busy, onSubmit, t }: WordScramblePuzzleProps) {
  const [selected, setSelected] = useState<string | null>(null);

  const submit = (word: string) => {
    if (busy || selected !== null) return;
    setSelected(word);
    void onSubmit(word).finally(() => setSelected(null));
  };

  return (
    <>
      <PuzzleHeader title={t.puzzleScrambleTitle} instruction={t.puzzleScrambleInstruction} index={index} total={total} t={t} />
      <div className="scramble-word" aria-label={t.puzzleScrambleInstruction}>
        {[...payload.scrambled].join(" ")}
      </div>
      <div className="choices">
        {payload.options.map((word) => (
          <button
            key={word}
            type="button"
            className={`choice${selected === word ? " hot" : ""}`}
            disabled={busy}
            onClick={() => submit(word)}
          >
            {word}
          </button>
        ))}
      </div>
    </>
  );
}
