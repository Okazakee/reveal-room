"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PublicRoomState } from "@/lib/types";

export type ConnectionStatus = "connecting" | "connected" | "reconnecting" | "gone";

interface UseRoomPollingResult {
  state: PublicRoomState | null;
  status: ConnectionStatus;
  /** Immediately fetch a fresh snapshot (after local mutations). */
  refresh: () => void;
}

const VISIBLE_INTERVAL_MS = 1000;
const HIDDEN_INTERVAL_MS = 3000;

/**
 * RR-CLIENT-001 / RR-POLL-*: poll the sanitized public snapshot instead of
 * using an event stream. Responsibilities:
 * - immediate initial fetch;
 * - poll every ~1 s while the tab is visible (slower when hidden);
 * - skip React state churn when `version` is unchanged;
 * - transient failures keep the last snapshot and show `reconnecting`;
 * - authoritative 404 → `gone` (stop polling);
 * - immediate poll on `visibilitychange → visible`;
 * - `refresh()` for an immediate poll after the client's own mutations;
 * - stop on unmount.
 */
export function useRoomPolling(code: string): UseRoomPollingResult {
  const [state, setState] = useState<PublicRoomState | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>("connecting");

  const versionRef = useRef<number | null>(null);
  const pollRef = useRef<() => void>(() => {});
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;
    let inFlight = false;

    const poll = async (): Promise<void> => {
      if (inFlight || cancelledRef.current) return;
      inFlight = true;
      try {
        const res = await fetch(`/api/rooms/${code}`, { cache: "no-store" });
        if (cancelledRef.current) return;
        if (res.status === 404) {
          // Authoritative room-gone from shared state.
          setStatus("gone");
          return;
        }
        if (!res.ok) throw new Error(`poll ${res.status}`);
        const json = (await res.json()) as { ok: true; data: PublicRoomState };
        if (json.data.version !== versionRef.current) {
          versionRef.current = json.data.version;
          setState(json.data);
        }
        setStatus("connected");
      } catch {
        if (!cancelledRef.current) setStatus("reconnecting"); // keep last snapshot
      } finally {
        inFlight = false;
      }
      schedule();
    };

    const schedule = (): void => {
      timerRef.current = setTimeout(
        () => void poll(),
        document.visibilityState === "visible" ? VISIBLE_INTERVAL_MS : HIDDEN_INTERVAL_MS,
      );
    };

    pollRef.current = () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
      void poll();
    };

    void poll();

    const onVisibilityChange = (): void => {
      if (document.visibilityState === "visible") pollRef.current();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      cancelledRef.current = true;
      if (timerRef.current !== null) clearTimeout(timerRef.current);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [code]);

  const refresh = useCallback(() => {
    pollRef.current();
  }, []);

  return { state, status, refresh };
}
