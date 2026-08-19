"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/Button";
import { PlayerRoster } from "@/components/PlayerRoster";
import { ProgressLocks } from "@/components/ProgressLocks";
import { SealMark } from "@/components/SealMark";
import { SecretDisplay } from "@/components/SecretDisplay";
import { StatusScreen } from "@/components/StatusScreen";
import { Unsealed } from "@/components/Unsealed";
import { MemoryPuzzle, type MemoryPayload } from "@/components/puzzles/MemoryPuzzle";
import { OddOneOutPuzzle, type OddOneOutPayload } from "@/components/puzzles/OddOneOutPuzzle";
import { OrderPuzzle, type OrderPayload } from "@/components/puzzles/OrderPuzzle";
import { QuickMathPuzzle, type QuickMathPayload } from "@/components/puzzles/QuickMathPuzzle";
import { SequencePuzzle, type SequencePayload } from "@/components/puzzles/SequencePuzzle";
import { WordScramblePuzzle, type WordScramblePayload } from "@/components/puzzles/WordScramblePuzzle";
import {
  apiFetchChallenge,
  apiJoinRoom,
  apiResumeRoom,
  apiSubmitAnswer,
  ClientError,
  errorMessage,
  type ChallengePayload,
} from "@/lib/client/api";
import {
  clearParticipantCredentials,
  getParticipantCredentials,
  saveParticipantCredentials,
  type StoredParticipantCredentials,
} from "@/lib/client/storage";
import { usePresence, type PresenceAuth } from "@/lib/client/usePresence";
import { useRoomPolling } from "@/lib/client/useRoomPolling";
import { format, getMessages, resolveUiLocale } from "@/lib/i18n";
import type { Messages } from "@/lib/i18n";
import type { ChallengeType } from "@/lib/types";

const PUZZLE_TITLE_KEYS: Record<ChallengeType, keyof Messages> = {
  sequence: "puzzleSequenceTitle",
  memory: "puzzleMemoryTitle",
  "odd-one-out": "puzzleOddTitle",
  "quick-math": "puzzleMathTitle",
  "word-scramble": "puzzleScrambleTitle",
  order: "puzzleOrderTitle",
} as const;

export function PlayerRoom({ code }: { code: string }) {
  const { state, status, refresh } = useRoomPolling(code);
  const [creds, setCreds] = useState<StoredParticipantCredentials | null>(() =>
    getParticipantCredentials(code),
  );
  const [joinState, setJoinState] = useState<"resuming" | "form" | "joined">(() =>
    getParticipantCredentials(code) !== null ? "resuming" : "form",
  );
  const [joinError, setJoinError] = useState<string | null>(null);
  const [name, setName] = useState("");

  const locale = state !== null ? state.locale : resolveUiLocale();
  const t = useMemo(() => getMessages(locale), [locale]);

  // Attempt resume once with stored credentials (RR-JOIN-002).
  useEffect(() => {
    if (creds === null || joinState !== "resuming") return;
    let cancelled = false;
    apiResumeRoom(code, creds.participantId, creds.participantToken)
      .then(() => {
        if (!cancelled) {
          setJoinState("joined");
          refresh();
        }
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        if (error instanceof ClientError && error.code === "UNAUTHORIZED") {
          clearParticipantCredentials(code);
          setCreds(null);
          setJoinState("form");
        } else {
          setJoinState("form");
          setJoinError(errorMessage(t, error));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [code, creds, joinState, t, refresh]);

  const getAuth = useCallback<() => PresenceAuth | null>(() => {
    if (creds === null || joinState !== "joined") return null;
    return { token: creds.participantToken, participantId: creds.participantId };
  }, [creds, joinState]);
  usePresence(code, getAuth, joinState === "joined" && status !== "gone");

  const join = async (event: React.FormEvent) => {
    event.preventDefault();
    if (joinState === "joined") return;
    setJoinError(null);
    try {
      const result = await apiJoinRoom(code, name);
      const credentials = { participantId: result.participantId, participantToken: result.participantToken ?? "" };
      saveParticipantCredentials(code, credentials);
      setCreds(credentials);
      setJoinState("joined");
      refresh();
    } catch (error) {
      setJoinError(errorMessage(t, error));
    }
  };

  if (status === "gone") {
    // RR-CONN-003: room no longer exists — stop heartbeats (presence hook is
    // gated on status), close the stream (hook cleanup) and drop stale creds.
    if (creds !== null) {
      clearParticipantCredentials(code);
      setCreds(null);
    }
    return (
      <StatusScreen
        icon={<SealMark variant="outline" size={40} />}
        title={t.roomGoneTitle}
        sub={t.roomGoneSub}
        action={
          <Link href="/">
            <Button variant="primary">{t.backHome}</Button>
          </Link>
        }
      />
    );
  }

  if (state === null) {
    return (
      <StatusScreen
        icon={<span className="spinner" />}
        title={status === "reconnecting" ? t.reconnecting : t.loading}
      />
    );
  }

  if (joinState === "form") {
    return (
      <div className="player-shell">
        <div className="center-title">
          <div className="lock">
            <SealMark variant="outline" size={36} />
          </div>
          <h3>{state.title}</h3>
          <div className="sub">{t.joinTitle}</div>
        </div>
        <form className="card" onSubmit={join} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div className="field" style={{ margin: 0 }}>
            <label className="name" htmlFor="player-name">
              {t.nameLabel}
            </label>
            <input
              id="player-name"
              className="input"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={t.namePlaceholder}
              maxLength={24}
              autoComplete="nickname"
            />
          </div>
          <Button variant="primary" block type="submit" disabled={name.trim().length === 0}>
            {t.joinButton}
          </Button>
          {joinError !== null ? <div className="join-err">{joinError}</div> : null}
        </form>
      </div>
    );
  }

  const participantId = creds?.participantId ?? "";
  const isAssignee =
    state.currentChallenge !== undefined &&
    state.currentChallenge.assigneeId === participantId &&
    state.status !== "completed";
  const paused = state.status === "paused";

  return (
    <div className="player-shell">
      <PlayerTopRow code={code} title={state.title} />
      {paused ? (
        <div className="card paused-overlay">
          <div className="lock small">
            <SealMark variant="outline" size={25} />
          </div>
          <div className="center-title">
            <h3 style={{ fontSize: 17 }}>{t.pausedMessage}</h3>
          </div>
        </div>
      ) : null}
      {state.status === "lobby" ? (
        <LobbyView state={state} participantId={participantId} t={t} />
      ) : state.status === "completed" ? (
        <Unsealed
          secret={state.maskedSecret}
          finalMessage={state.finalMessage}
          completed={state.progress.completed}
          total={state.challengeCount}
          playerCount={state.roster.filter((p) => p.role === "player").length}
          elapsedMs={state.stats?.elapsedMs ?? 0}
          gameMode={state.gameMode}
          t={t}
        />
      ) : isAssignee && creds !== null ? (
        <PuzzleArea
          code={code}
          state={state}
          creds={creds}
          paused={paused}
          t={t}
          refresh={refresh}
        />
      ) : (
        <SpectatorView state={state} participantId={participantId} t={t} paused={paused} />
      )}
    </div>
  );
}

function PlayerTopRow({ code, title }: { code: string; title: string }) {
  return (
    <div className="mini-top" style={{ padding: "2px 4px" }}>
      <div className="mini-brand">
        <span className="seal">
          <SealMark variant="solid" size={12} />
        </span>
        <span style={{ maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {title}
        </span>
      </div>
      <div className="pill">{code}</div>
    </div>
  );
}

function LobbyView({
  state,
  participantId,
  t,
}: {
  state: NonNullable<ReturnType<typeof useRoomPolling>["state"]>;
  participantId: string;
  t: Messages;
}) {
  const role = state.roster.find((p) => p.id === participantId)?.role;
  return (
    <>
      <div className="center-title">
        <div className="lock">
          <SealMark variant="outline" size={36} />
        </div>
        <h3>{state.title}</h3>
        <div className="sub">
          {role === "spectator" ? t.spectatorNote : t.waitingForHost}
        </div>
      </div>
      <SecretDisplay label={t.revealPreviewLabel} masked={state.maskedSecret} />
      {state.roster.length > 0 ? (
        <div className="card">
          <div className="caption" style={{ marginBottom: 9 }}>
            {t.playersLabel}
          </div>
          <PlayerRoster roster={state.roster} currentId={participantId} t={t} />
        </div>
      ) : null}
      <div className="waiting-block">
        <span className="spinner" />
        {t.waitingForHost}
      </div>
    </>
  );
}

function SpectatorView({
  state,
  participantId,
  t,
  paused,
}: {
  state: NonNullable<ReturnType<typeof useRoomPolling>["state"]>;
  participantId: string;
  t: Messages;
  paused: boolean;
}) {
  const current = state.currentChallenge;
  const assignee = current !== undefined ? state.roster.find((p) => p.id === current.assigneeId) : undefined;
  return (
    <>
      {current !== undefined ? (
        <div className="card turn-card">
          <span className="eyebrow">
            {format(t.turnIndex, { index: current.index, total: state.challengeCount })}
          </span>
          <div className="assignee-line" style={{ marginTop: 10 }}>
            {assignee !== undefined ? (
              <>
                <span className="avatar">{initials(assignee.displayName)}</span>
                <b style={{ fontSize: 13, color: "var(--text)" }}>{assignee.displayName}</b>
                <span>{t.breakingTheNextLock}</span>
              </>
            ) : (
              <span>{t.waitingForPlayers}</span>
            )}
          </div>
          <div style={{ textAlign: "center", color: "var(--muted)", fontSize: 11, marginTop: 8 }}>
            {t[PUZZLE_TITLE_KEYS[current.type]]}
          </div>
        </div>
      ) : null}
      {!paused ? (
        <ProgressLocks
          completed={state.progress.completed}
          currentIndex={state.progress.completed}
          total={state.challengeCount}
          t={t}
        />
      ) : null}
      <SecretDisplay label={t.currentRevealLabel} masked={state.maskedSecret} />
      {state.roster.length > 0 ? (
        <div className="card">
          <div className="caption" style={{ marginBottom: 9 }}>
            {t.playersLabel}
          </div>
          <PlayerRoster roster={state.roster} currentId={participantId} t={t} />
        </div>
      ) : null}
    </>
  );
}

function PuzzleArea({
  code,
  state,
  creds,
  paused,
  t,
  refresh,
}: {
  code: string;
  state: NonNullable<ReturnType<typeof useRoomPolling>["state"]>;
  creds: StoredParticipantCredentials;
  paused: boolean;
  t: Messages;
  refresh: () => void;
}) {
  const [fetched, setFetched] = useState<{ id: string; payload: ChallengePayload } | null>(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<"idle" | "wrong">("idle");

  const current = state.currentChallenge;
  const currentId = current?.id ?? null;

  // Fetch the private payload only when the snapshot says we are the
  // assignee (RR-CLIENT-004). Stale payloads for old challenge ids are
  // ignored during render; this effect refetches when the id changes.
  useEffect(() => {
    if (currentId === null) return;
    if (fetched !== null && fetched.id === currentId) return;
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const run = async (): Promise<void> => {
      if (cancelled) return;
      try {
        const payload = await apiFetchChallenge(code, creds.participantToken, creds.participantId);
        if (!cancelled) {
          setFetched({ id: currentId, payload });
          setFeedback("idle");
        }
      } catch (error) {
        if (cancelled) return;
        if (error instanceof ClientError && error.code === "NOT_ASSIGNEE") return;
        // Transient failure: retry shortly; the snapshot heals on reconnect.
        retryTimer = setTimeout(() => void run(), 2000);
      }
    };

    void run();
    return () => {
      cancelled = true;
      if (retryTimer !== null) clearTimeout(retryTimer);
    };
  }, [currentId, code, creds, fetched]);

  const fetchedChallenge = fetched !== null && fetched.id === currentId ? fetched.payload : null;

  const submitAnswer = async (answer: unknown) => {
    if (busy || fetchedChallenge === null) return;
    setBusy(true);
    setFeedback("idle");
    try {
      const result = await apiSubmitAnswer(
        code,
        creds.participantToken,
        creds.participantId,
        fetchedChallenge.id,
        answer,
      );
      if (result.correct) {
        // Snapshot will advance; refetch happens for the next challenge id.
        setFetched(null);
        refresh(); // acting client sees the reveal/progress immediately
      } else {
        setFeedback("wrong");
      }
    } catch (error) {
      if (error instanceof ClientError && error.code === "STALE_CHALLENGE") {
        setFetched(null);
      } else {
        setFeedback("wrong");
      }
    } finally {
      setBusy(false);
    }
  };

  const common = {
    index: current?.index ?? fetchedChallenge?.index ?? 1,
    total: state.challengeCount,
    busy: busy || paused,
    onSubmit: submitAnswer,
    t,
  };

  return (
    <>
      {fetchedChallenge === null ? (
        <div className="card" style={{ display: "grid", placeItems: "center", minHeight: 160 }}>
          <span className="spinner" />
        </div>
      ) : (
        <div className="card" key={fetchedChallenge.id}>
          {fetchedChallenge.type === "sequence" ? (
            <SequencePuzzle payload={fetchedChallenge.payload as SequencePayload} {...common} />
          ) : fetchedChallenge.type === "memory" ? (
            <MemoryPuzzle payload={fetchedChallenge.payload as MemoryPayload} {...common} />
          ) : fetchedChallenge.type === "odd-one-out" ? (
            <OddOneOutPuzzle payload={fetchedChallenge.payload as OddOneOutPayload} {...common} />
          ) : fetchedChallenge.type === "quick-math" ? (
            <QuickMathPuzzle payload={fetchedChallenge.payload as QuickMathPayload} {...common} />
          ) : fetchedChallenge.type === "word-scramble" ? (
            <WordScramblePuzzle payload={fetchedChallenge.payload as WordScramblePayload} {...common} />
          ) : (
            <OrderPuzzle payload={fetchedChallenge.payload as OrderPayload} {...common} />
          )}
          <div className={`puzzle-feedback ${feedback}`} aria-live="polite">
            {feedback === "wrong" ? t.wrongAnswer : "\u00A0"}
          </div>
        </div>
      )}
      {!paused ? (
        <ProgressLocks
          completed={state.progress.completed}
          currentIndex={state.progress.completed}
          total={state.challengeCount}
          t={t}
        />
      ) : null}
      <SecretDisplay label={t.currentRevealLabel} masked={state.maskedSecret} />
      <div className="card">
        <div className="caption" style={{ marginBottom: 9 }}>
          {t.playersLabel}
        </div>
        <PlayerRoster roster={state.roster} currentId={creds.participantId} t={t} />
      </div>
    </>
  );
}

function initials(name: string): string {
  const trimmed = name.trim();
  const words = trimmed.split(/\s+/);
  if (words.length === 1) return words[0]!.slice(0, 2).toUpperCase();
  return (words[0]![0]! + words[1]![0]!).toUpperCase();
}
