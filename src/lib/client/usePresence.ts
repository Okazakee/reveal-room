"use client";

import { useEffect } from "react";

export interface PresenceAuth {
  token: string;
  participantId?: string;
}

/**
 * RR-CLIENT-002: authenticated heartbeat every 15 s (RR-PRES-001).
 * `getAuth` must be referentially stable (useCallback) so the effect does
 * not restart every render. Stops when the room is gone.
 */
export function usePresence(
  code: string,
  getAuth: () => PresenceAuth | null,
  enabled: boolean,
): void {
  useEffect(() => {
    if (!enabled) return;
    let stopped = false;

    const beat = async (): Promise<void> => {
      if (stopped) return;
      const auth = getAuth();
      if (auth === null) return;
      try {
        await fetch(`/api/rooms/${code}/presence`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${auth.token}`,
            ...(auth.participantId !== undefined ? { "X-Participant-Id": auth.participantId } : {}),
          },
          cache: "no-store",
        });
      } catch {
        // One dropped beat is harmless; the next interval retries.
      }
    };

    void beat();
    const timer = setInterval(() => void beat(), 15_000);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [code, getAuth, enabled]);
}
