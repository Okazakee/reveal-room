"use client";

import type { Messages } from "@/lib/i18n";
import type { PublicRosterEntry } from "@/lib/types";

interface PlayerRosterProps {
  roster: PublicRosterEntry[];
  /** Participant id highlighted as current (assignee or self). */
  currentId?: string;
  t: Messages;
}

function initials(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length === 0) return "?";
  const words = trimmed.split(/\s+/);
  if (words.length === 1) return words[0]!.slice(0, 2).toUpperCase();
  return (words[0]![0]! + words[1]![0]!).toUpperCase();
}

/** Compact roster rows with initials avatars and green presence dots (RR-VIS-012). */
export function PlayerRoster({ roster, currentId, t }: PlayerRosterProps) {
  return (
    <div className="players">
      {roster.map((player) => (
        <div key={player.id} className={`player${player.id === currentId ? " current" : ""}`}>
          <span className="person">
            <span className="avatar">{initials(player.displayName)}</span>
            <b>{player.displayName}</b>
          </span>
          <span style={{ display: "flex", gap: 7, alignItems: "center" }}>
            {player.role === "spectator" ? (
              <span className="role-tag">{t.spectatorTag}</span>
            ) : null}
            <span className={`online${player.isActive ? "" : " off"}`} aria-hidden="true" />
          </span>
        </div>
      ))}
    </div>
  );
}
