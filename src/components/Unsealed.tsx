"use client";

import { useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/Button";
import { SealMark } from "@/components/SealMark";
import { format } from "@/lib/i18n";
import type { Messages } from "@/lib/i18n";
import type { GameMode } from "@/lib/types";

/** Live prefers-reduced-motion subscription (no setState-in-effect). */
function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    (onStoreChange) => {
      const query = window.matchMedia("(prefers-reduced-motion: reduce)");
      query.addEventListener("change", onStoreChange);
      return () => query.removeEventListener("change", onStoreChange);
    },
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );
}

interface UnsealedProps {
  /** Fully revealed display string (equals the plaintext secret). */
  secret: string;
  finalMessage?: string;
  completed: number;
  total: number;
  playerCount: number;
  elapsedMs: number;
  gameMode: GameMode;
  t: Messages;
}

function formatElapsed(t: Messages, ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return format(t.metaElapsed, { minutes, seconds });
}

interface Particle {
  left: number;
  delay: number;
  duration: number;
  color: string;
}

/**
 * RR-VIS-013 completion payoff: brighter centered composition, open seal,
 * large "Unsealed." title, prominent selectable secret card, yellow copy
 * action, metadata row and a small CSS-only celebratory effect.
 */
export function Unsealed({ secret, finalMessage, completed, total, playerCount, elapsedMs, gameMode, t }: UnsealedProps) {
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const reducedMotion = usePrefersReducedMotion();
  const secretRef = useRef<HTMLDivElement>(null);

  const particles = useMemo<Particle[]>(() => {
    if (reducedMotion) return [];
    const colors = ["var(--accent)", "var(--accent-strong)", "#e8b64c", "#fff2cc"];
    return Array.from({ length: 18 }, (_, i) => ({
      left: (i * 53) % 100,
      delay: (i % 6) * 0.18,
      duration: 2.4 + (i % 5) * 0.35,
      color: colors[i % colors.length]!,
    }));
  }, [reducedMotion]);

  const copySecret = async () => {
    setCopied(false);
    setCopyFailed(false);
    try {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
    } catch {
      // Clipboard API unavailable: keep the text selectable and tell the user.
      const element = secretRef.current;
      if (element !== null) {
        try {
          const range = document.createRange();
          range.selectNodeContents(element);
          const selection = window.getSelection();
          selection?.removeAllRanges();
          selection?.addRange(range);
        } catch {
          // Selection also failed; fallback message below.
        }
      }
      setCopyFailed(true);
    }
    window.setTimeout(() => setCopied(false), 2500);
  };

  const modeLabel = gameMode === "solo" ? t.metaModeSolo : t.metaModeParty;
  const sub =
    gameMode === "solo"
      ? format(t.unsealedSubSolo, { locks: total })
      : format(t.unsealedSubParty, { locks: total, players: playerCount });

  return (
    <div className="final" role="status">
      {particles.length > 0 ? (
        <div className="confetti" aria-hidden="true">
          {particles.map((particle, i) => (
            <i
              key={i}
              style={{
                left: `${particle.left}%`,
                animationDelay: `${particle.delay}s`,
                animationDuration: `${particle.duration}s`,
                background: particle.color,
              }}
            />
          ))}
        </div>
      ) : null}
      <div className="final-inner">
        <div className="burst">
          <SealMark variant="open" size={46} />
        </div>
        <h3>{t.unsealed}</h3>
        <p className="final-sub">{sub}</p>
        {finalMessage !== undefined && finalMessage.length > 0 ? (
          <p className="final-message">{finalMessage}</p>
        ) : null}
        <div className="full" ref={secretRef} data-testid="revealed-secret">
          {secret}
        </div>
        <div className="copy-row">
          <Button variant="primary" onClick={() => void copySecret()}>
            {copied ? t.secretCopied : t.copySecret}
          </Button>
        </div>
        {copyFailed ? <div className="copy-fail">{t.copyFailed}</div> : null}
        <div className="meta">
          <span>{format(t.metaChallenges, { completed, total })}</span>
          <span>{formatElapsed(t, elapsedMs)}</span>
          <span>{modeLabel}</span>
        </div>
      </div>
    </div>
  );
}
