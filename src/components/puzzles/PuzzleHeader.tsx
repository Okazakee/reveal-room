"use client";

import type { Messages } from "@/lib/i18n";
import { format } from "@/lib/i18n";

interface PuzzleHeaderProps {
  title: string;
  instruction: string;
  index: number;
  total: number;
  t: Messages;
}

/** Shared challenge header: accent eyebrow, title, instruction (RR-VIS-009). */
export function PuzzleHeader({ title, instruction, index, total, t }: PuzzleHeaderProps) {
  return (
    <div className="challenge">
      <small>
        {t.yourTurn} · {format(t.turnIndex, { index, total })}
      </small>
      <h4>{title}</h4>
      <div className="sub" style={{ color: "var(--muted)", fontSize: 12, marginTop: 2 }}>
        {instruction}
      </div>
    </div>
  );
}
