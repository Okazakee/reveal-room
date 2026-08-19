"use client";

import type { Messages } from "@/lib/i18n";
import { format } from "@/lib/i18n";

interface ProgressLocksProps {
  completed: number;
  /** 0-based index of the segment that represents the current challenge. */
  currentIndex: number;
  total: number;
  t: Messages;
  align?: "center" | "start";
}

/**
 * Challenge progression as small rounded lock/segment markers (RR-VIS-011):
 * completed = accent, current = partial accent, remaining = subdued dark.
 */
export function ProgressLocks({ completed, currentIndex, total, t, align = "center" }: ProgressLocksProps) {
  const segments = [];
  for (let i = 0; i < total; i++) {
    const state = i < completed ? "done" : i === currentIndex ? "current" : "";
    segments.push(
      <i key={i} className={state} role="presentation" />,
    );
  }
  const label = format(t.turnIndex, { index: Math.min(currentIndex + 1, total), total });
  return (
    <div
      className="progress"
      style={align === "start" ? { justifyContent: "flex-start" } : undefined}
      role="img"
      aria-label={label}
    >
      {segments}
    </div>
  );
}
