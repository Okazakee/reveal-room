"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/Button";
import { Dialog } from "@/components/Dialog";
import { PlayerRoster } from "@/components/PlayerRoster";
import { ProgressLocks } from "@/components/ProgressLocks";
import { SealMark } from "@/components/SealMark";
import { SecretDisplay } from "@/components/SecretDisplay";
import { StatusScreen } from "@/components/StatusScreen";
import { Unsealed } from "@/components/Unsealed";
import { apiDeleteRoom, apiHostAction, errorMessage } from "@/lib/client/api";
import { clearHostToken, getHostToken } from "@/lib/client/storage";
import { usePresence, type PresenceAuth } from "@/lib/client/usePresence";
import { useRoomPolling } from "@/lib/client/useRoomPolling";
import { getMessages, resolveUiLocale, format } from "@/lib/i18n";
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

type ConfirmTarget = "reveal" | "reset" | "delete" | null;

export function HostRoom({ code }: { code: string }) {
  const [hostToken] = useState<string | null>(() => getHostToken(code));
  const { state, status, refresh } = useRoomPolling(code);
  const locale = state !== null ? state.locale : resolveUiLocale();
  const t = useMemo(() => getMessages(locale), [locale]);

  const getAuth = useCallback<() => PresenceAuth | null>(
    () => (hostToken !== null ? { token: hostToken } : null),
    [hostToken],
  );
  usePresence(code, getAuth, hostToken !== null && status !== "gone");

  const [confirmTarget, setConfirmTarget] = useState<ConfirmTarget>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [deleted, setDeleted] = useState(false);

  // RR-PRES-007 / RR-CONN-003: when the room is gone, clear stale host
  // credentials so a fresh visit does not claim host access for a dead room.
  useEffect(() => {
    if (status === "gone" || deleted) clearHostToken(code);
  }, [status, deleted, code]);

  if (hostToken === null) {
    return (
      <StatusScreen
        icon={<SealMark variant="outline" size={40} />}
        title={t.hostAccessError}
        sub={t.hostAccessErrorSub}
        action={
          <Link href="/create">
            <Button variant="primary">{t.createCta}</Button>
          </Link>
        }
      />
    );
  }

  if (deleted) {
    return (
      <StatusScreen
        icon={<SealMark variant="open" size={40} />}
        title={t.roomDeleted}
        action={
          <Link href="/">
            <Button variant="primary">{t.backHome}</Button>
          </Link>
        }
      />
    );
  }

  if (status === "gone") {
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

  const playerPath = `${window.location.origin}/r/${code}`;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(playerPath);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      setActionError(t.copyFailed);
    }
  };

  const share = async () => {
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ url: playerPath });
      } else {
        await copyLink();
      }
    } catch {
      // User dismissed the share sheet; nothing to do.
    }
  };

  const runAction = async (action: string) => {
    setActionError(null);
    try {
      await apiHostAction(code, hostToken, action);
      refresh(); // acting client sees the new state immediately
    } catch (error) {
      setActionError(errorMessage(t, error));
    }
  };

  const confirmDialog = async () => {
    if (confirmTarget === "reveal") {
      setConfirmTarget(null);
      await runAction("reveal");
    } else if (confirmTarget === "reset") {
      setConfirmTarget(null);
      await runAction("reset");
    } else if (confirmTarget === "delete") {
      setConfirmTarget(null);
      setActionError(null);
      try {
        await apiDeleteRoom(code, hostToken);
        setDeleted(true);
      } catch (error) {
        setActionError(errorMessage(t, error));
      }
    }
  };

  const activePlayers = state.roster.filter((p) => p.role === "player" && p.isActive).length;
  const startDisabled =
    state.status !== "lobby" ||
    (state.gameMode === "solo" ? activePlayers < 1 : activePlayers < 2);
  const startHint =
    state.status !== "lobby"
      ? null
      : state.gameMode === "solo"
        ? t.startDisabledSolo
        : t.startDisabledParty;

  const current = state.currentChallenge;
  const assignee = current !== undefined ? state.roster.find((p) => p.id === current.assigneeId) : undefined;

  const dialogCopy =
    confirmTarget === "reveal"
      ? { title: t.confirmDialogTitle, message: t.confirmReveal }
      : confirmTarget === "reset"
        ? { title: t.confirmDialogTitle, message: t.confirmReset }
        : { title: t.confirmDialogTitle, message: t.confirmDelete };

  return (
    <div className="host-grid">
      <div className="host-main">
        <div className="host-stack">
          <div className="card">
            <div className="stat">
              <div>
                <div className="caption">{t.roomCodeLabel}</div>
                <div className="roomcode">{state.code}</div>
              </div>
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                <button type="button" className="tiny" onClick={() => void copyLink()}>
                  {copied ? t.copied : t.copy}
                </button>
                {typeof navigator !== "undefined" && typeof navigator.share === "function" ? (
                  <button type="button" className="tiny" onClick={() => void share()}>
                    {t.share}
                  </button>
                ) : null}
              </div>
            </div>
            <div className="mode-chips" style={{ marginTop: 12 }}>
              <span className="tiny">{state.gameMode === "solo" ? t.modeSolo : t.modeParty}</span>
              <span className="tiny">
                {state.revealMode === "progressive" ? t.revealProgressive : t.revealFinal}
              </span>
              <span className="tiny">{String(state.challengeCount)}</span>
            </div>
          </div>

          {state.status === "lobby" ? (
            <div className="card">
              <div className="caption" style={{ marginBottom: 10 }}>
                {t.playersLabel}
              </div>
              {state.roster.length > 0 ? (
                <PlayerRoster roster={state.roster} t={t} />
              ) : (
                <div className="waiting-block">{t.waitingForPlayers}</div>
              )}
            </div>
          ) : (
            <>
              <div className="card">
                <div className="caption">
                  {format(t.currentChallengeLabel, {
                    index: Math.min(state.progress.completed + 1, state.challengeCount),
                    total: state.challengeCount,
                  })}
                </div>
                <h3 style={{ margin: "6px 0 0", fontSize: 17 }}>
                  {current !== undefined ? t[PUZZLE_TITLE_KEYS[current.type]] : t.noChallengeYet}
                </h3>
                <div className="turn">
                  {assignee !== undefined ? (
                    <>
                      <span className="avatar">{initials(assignee.displayName)}</span>
                      <div>
                        <b style={{ fontSize: 12 }}>{assignee.displayName}</b>
                        <div style={{ fontSize: 10, color: "var(--muted)" }}>{t.breakingTheNextLock}</div>
                      </div>
                    </>
                  ) : (
                    <div style={{ fontSize: 11, color: "var(--muted)" }}>{t.waitingForPlayers}</div>
                  )}
                  <div className="live">{t.live}</div>
                </div>
              </div>
              <SecretDisplay label={t.currentRevealLabel} masked={state.maskedSecret} />
              <ProgressLocks
                completed={state.progress.completed}
                currentIndex={state.progress.completed}
                total={state.challengeCount}
                t={t}
                align="start"
              />
            </>
          )}
        </div>

        <div className="host-stack">
          <div className="card">
            <div className="caption" style={{ marginBottom: 9 }}>
              {t.controlsLabel}
            </div>
            {state.status === "lobby" ? (
              <>
                <Button variant="primary" block disabled={startDisabled} onClick={() => void runAction("start")}>
                  {t.startButton}
                </Button>
                {startDisabled && startHint !== null ? <div className="start-hint">{startHint}</div> : null}
              </>
            ) : (
              <div className="controls-grid">
                <Button
                  variant="secondary"
                  size="small"
                  onClick={() => void runAction(state.status === "paused" ? "resume" : "pause")}
                  disabled={state.status !== "playing" && state.status !== "paused"}
                >
                  {state.status === "paused" ? t.resumeButton : t.pauseButton}
                </Button>
                <Button variant="secondary" size="small" onClick={() => void runAction("skip")}>
                  {t.skipButton}
                </Button>
                <Button variant="danger" size="small" onClick={() => setConfirmTarget("reveal")}>
                  {t.revealNowButton}
                </Button>
                <Button variant="danger" size="small" onClick={() => setConfirmTarget("reset")}>
                  {t.resetButton}
                </Button>
              </div>
            )}
            <div style={{ marginTop: 8 }}>
              <Button variant="danger" size="small" block onClick={() => setConfirmTarget("delete")}>
                {t.deleteRoomButton}
              </Button>
            </div>
            {actionError !== null ? <div className="join-err" style={{ marginTop: 8 }}>{actionError}</div> : null}
          </div>

          {state.status !== "lobby" ? (
            <div className="card">
              <div className="caption" style={{ marginBottom: 9 }}>
                {t.playersLabel}
              </div>
              <PlayerRoster roster={state.roster} currentId={current?.assigneeId} t={t} />
            </div>
          ) : null}
        </div>
      </div>

      {state.status === "completed" ? (
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
      ) : null}

      {confirmTarget !== null ? (
        <Dialog
          title={dialogCopy.title}
          message={dialogCopy.message}
          confirmLabel={t.confirmAction}
          cancelLabel={t.cancel}
          danger
          onConfirm={() => void confirmDialog()}
          onCancel={() => setConfirmTarget(null)}
        />
      ) : null}
    </div>
  );
}

function initials(name: string): string {
  const trimmed = name.trim();
  const words = trimmed.split(/\s+/);
  if (words.length === 1) return words[0]!.slice(0, 2).toUpperCase();
  return (words[0]![0]! + words[1]![0]!).toUpperCase();
}
