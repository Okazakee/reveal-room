"use client";

import { useState } from "react";
import { PuzzleHeader } from "@/components/puzzles/PuzzleHeader";
import { format } from "@/lib/i18n";
import type { Messages } from "@/lib/i18n";

export interface OrderPayload {
  type: "order";
  numbers: number[];
}

interface OrderPuzzleProps {
  payload: OrderPayload;
  index: number;
  total: number;
  busy: boolean;
  onSubmit: (answer: unknown) => Promise<void>;
  t: Messages;
}

/** Tap five numbers from smallest to largest (RR-22.6). */
export function OrderPuzzle({ payload, index, total, busy, onSubmit, t }: OrderPuzzleProps) {
  const [picked, setPicked] = useState<number[]>([]);

  const tap = (value: number) => {
    if (busy) return;
    if (picked.includes(value)) {
      setPicked((current) => current.filter((v) => v !== value));
      return;
    }
    const next = [...picked, value];
    setPicked(next);
    if (next.length === payload.numbers.length) {
      void onSubmit(next).finally(() => setPicked([]));
    }
  };

  return (
    <>
      <PuzzleHeader title={t.puzzleOrderTitle} instruction={t.puzzleOrderInstruction} index={index} total={total} t={t} />
      <div className="order-tiles">
        {payload.numbers.map((value) => (
          <button
            key={value}
            type="button"
            className={`tile${picked.includes(value) ? " hot" : ""}`}
            disabled={busy}
            onClick={() => tap(value)}
          >
            {value}
          </button>
        ))}
      </div>
      <div style={{ textAlign: "center", color: "var(--faint)", fontSize: 10, marginTop: 15 }} aria-live="polite">
        {picked.length > 0
          ? format(t.puzzleOrderSelected, { order: picked.join(" → ") })
          : "\u00A0"}
      </div>
    </>
  );
}
