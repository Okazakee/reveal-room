"use client";

import { useState } from "react";
import { PuzzleHeader } from "@/components/puzzles/PuzzleHeader";
import type { Messages } from "@/lib/i18n";

export interface MemoryPayload {
  type: "memory";
  length: number;
  symbols: string[];
  buttons: string[];
}

interface MemoryPuzzleProps {
  payload: MemoryPayload;
  index: number;
  total: number;
  busy: boolean;
  onSubmit: (answer: unknown) => Promise<void>;
  t: Messages;
}

/** Memorize a glyph sequence, then reproduce it by tapping (RR-22.2). */
export function MemoryPuzzle({ payload, index, total, busy, onSubmit, t }: MemoryPuzzleProps) {
  const [phase, setPhase] = useState<"memorize" | "reproduce">("memorize");
  const [picked, setPicked] = useState<string[]>([]);

  const tapButton = (glyph: string) => {
    if (busy || phase !== "reproduce") return;
    setPicked((current) => [...current, glyph]);
  };

  const submit = () => {
    if (busy) return;
    void onSubmit(picked).finally(() => setPicked([]));
  };

  if (phase === "memorize") {
    return (
      <>
        <PuzzleHeader title={t.puzzleMemoryTitle} instruction={t.puzzleMemoryInstruction} index={index} total={total} t={t} />
        <div className="memory-stage">
          <div className="memory-glyphs">
            {payload.symbols.map((glyph, i) => (
              <span key={i} aria-hidden="true">
                {glyph}
              </span>
            ))}
          </div>
          <button type="button" className="btn primary" onClick={() => setPhase("reproduce")} autoFocus>
            {t.puzzleMemoryReady}
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <PuzzleHeader title={t.puzzleMemoryTitle} instruction={t.puzzleMemoryReproduce} index={index} total={total} t={t} />
      <div className="memory-picked" aria-live="polite">
        {picked.map((glyph, i) => (
          <span key={i} aria-hidden="true">
            {glyph}
          </span>
        ))}
      </div>
      <div className="memory-buttons">
        {payload.buttons.map((glyph) => (
          <button
            key={glyph}
            type="button"
            className={picked[picked.length - 1] === glyph ? "hot" : ""}
            disabled={busy}
            onClick={() => tapButton(glyph)}
            aria-label={glyph}
          >
            {glyph}
          </button>
        ))}
      </div>
      <div className="puzzle-actions">
        <button
          type="button"
          className="btn"
          disabled={busy || picked.length === 0}
          onClick={() => setPicked([])}
        >
          {t.puzzleClear}
        </button>
        <button
          type="button"
          className="btn primary puzzle-submit"
          disabled={busy || picked.length === 0}
          onClick={submit}
        >
          {t.puzzleSubmit}
        </button>
      </div>
    </>
  );
}
