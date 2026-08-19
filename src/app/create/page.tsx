"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { SealMark } from "@/components/SealMark";
import { TopBar } from "@/components/TopBar";
import { apiCreateRoom } from "@/lib/client/api";
import { errorMessage } from "@/lib/client/api";
import { saveHostToken } from "@/lib/client/storage";
import { getMessages, resolveUiLocale, storeUiLocale } from "@/lib/i18n";
import { CHALLENGE_COUNT_OPTIONS } from "@/lib/types";
import type { GameMode, Locale, RevealMode } from "@/lib/types";

function maskSecret(secret: string): string {
  if (secret.length === 0) return "";
  const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
  let out = "";
  for (const { segment } of segmenter.segment(secret)) {
    out += segment.trim() === "" ? segment : "•";
  }
  return out;
}

export default function CreatePage() {
  const router = useRouter();
  const [locale, setLocale] = useState<Locale>(() => resolveUiLocale());
  const t = useMemo(() => getMessages(locale), [locale]);

  const [secret, setSecret] = useState("");
  const [title, setTitle] = useState("");
  const [finalMessage, setFinalMessage] = useState("");
  const [gameMode, setGameMode] = useState<GameMode>("party");
  const [revealMode, setRevealMode] = useState<RevealMode>("progressive");
  const [challengeCount, setChallengeCount] = useState<(typeof CHALLENGE_COUNT_OPTIONS)[number]>(5);
  const [gameLocale, setGameLocale] = useState<Locale>(() => resolveUiLocale());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const changeLocale = (next: Locale) => {
    setLocale(next);
    storeUiLocale(next);
  };

  const createRoom = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await apiCreateRoom({
        secret,
        title: title.trim().length > 0 ? title.trim() : undefined,
        finalMessage: finalMessage.trim().length > 0 ? finalMessage.trim() : undefined,
        locale: gameLocale,
        gameMode,
        revealMode,
        challengeCount,
      });
      saveHostToken(result.code, result.hostToken);
      router.push(result.hostPath);
    } catch (err) {
      setError(errorMessage(t, err));
      setSubmitting(false);
    }
  };

  const maskedPreview = useMemo(() => maskSecret(secret), [secret]);

  return (
    <div className="wrap">
      <TopBar t={t} locale={locale} onLocaleChange={changeLocale} />
      <div style={{ maxWidth: 980, margin: "26px auto 0" }}>
        <div className="create-grid">
          <form className="card" onSubmit={createRoom} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div className="field">
              <label className="name" htmlFor="create-secret">
                {t.createSecretLabel}
              </label>
              <textarea
                id="create-secret"
                className="textarea"
                required
                value={secret}
                onChange={(event) => setSecret(event.target.value)}
                placeholder={t.createSecretPlaceholder}
                maxLength={560}
              />
              <div className="helper">{t.createSecretHelper}</div>
            </div>

            <div className="field">
              <label className="name" htmlFor="create-title">
                {t.createTitleLabel}
              </label>
              <input
                id="create-title"
                className="input"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder={t.createTitlePlaceholder}
                maxLength={80}
              />
            </div>

            <div className="field">
              <label className="name" htmlFor="create-final">
                {t.createFinalLabel}
              </label>
              <input
                id="create-final"
                className="input"
                value={finalMessage}
                onChange={(event) => setFinalMessage(event.target.value)}
                placeholder={t.createFinalPlaceholder}
                maxLength={160}
              />
            </div>

            <div className="field">
              <span className="name" id="create-mode-label">
                {t.createModeLabel}
              </span>
              <div className="seg" role="radiogroup" aria-labelledby="create-mode-label">
                <button
                  type="button"
                  className={gameMode === "solo" ? "on" : ""}
                  role="radio"
                  aria-checked={gameMode === "solo"}
                  onClick={() => setGameMode("solo")}
                >
                  {t.modeSolo}
                </button>
                <button
                  type="button"
                  className={gameMode === "party" ? "on" : ""}
                  role="radio"
                  aria-checked={gameMode === "party"}
                  onClick={() => setGameMode("party")}
                >
                  {t.modeParty}
                </button>
              </div>
            </div>

            <div className="field">
              <span className="name" id="create-reveal-label">
                {t.createRevealLabel}
              </span>
              <div className="seg" role="radiogroup" aria-labelledby="create-reveal-label">
                <button
                  type="button"
                  className={revealMode === "progressive" ? "on" : ""}
                  role="radio"
                  aria-checked={revealMode === "progressive"}
                  onClick={() => setRevealMode("progressive")}
                >
                  {t.revealProgressive}
                </button>
                <button
                  type="button"
                  className={revealMode === "final" ? "on" : ""}
                  role="radio"
                  aria-checked={revealMode === "final"}
                  onClick={() => setRevealMode("final")}
                >
                  {t.revealFinal}
                </button>
              </div>
            </div>

            <div className="field">
              <span className="name" id="create-count-label">
                {t.createCountLabel}
              </span>
              <div className="steps" role="radiogroup" aria-labelledby="create-count-label">
                {CHALLENGE_COUNT_OPTIONS.map((count) => (
                  <button
                    key={count}
                    type="button"
                    className={challengeCount === count ? "on" : ""}
                    role="radio"
                    aria-checked={challengeCount === count}
                    onClick={() => setChallengeCount(count)}
                  >
                    {count}
                  </button>
                ))}
              </div>
            </div>

            <div className="field">
              <span className="name" id="create-lang-label">
                {t.createLangLabel}
              </span>
              <div className="seg" role="radiogroup" aria-labelledby="create-lang-label">
                <button
                  type="button"
                  className={gameLocale === "en" ? "on" : ""}
                  role="radio"
                  aria-checked={gameLocale === "en"}
                  onClick={() => setGameLocale("en")}
                >
                  {t.langEnFull}
                </button>
                <button
                  type="button"
                  className={gameLocale === "it" ? "on" : ""}
                  role="radio"
                  aria-checked={gameLocale === "it"}
                  onClick={() => setGameLocale("it")}
                >
                  {t.langItFull}
                </button>
              </div>
            </div>

            <Button variant="primary" block type="submit" disabled={submitting || secret.trim().length === 0}>
              {submitting ? t.creating : t.createButton}
            </Button>
            {error !== null ? <div className="join-err">{error}</div> : null}
          </form>

          <div className="preview">
            <div className="lock">
              <SealMark variant="outline" size={36} />
            </div>
            <h4 style={{ textAlign: "center", margin: "0 0 4px", fontSize: 17 }}>
              {title.trim().length > 0 ? title.trim() : t.createTitlePlaceholder}
            </h4>
            <p style={{ textAlign: "center", color: "var(--muted)", fontSize: 11, margin: "0 0 10px" }}>
              {t.previewNote}
            </p>
            <div className="secret-card">
              <div className="label">{t.previewLabel}</div>
              <div className="secret">
                {maskedPreview.length > 0 ? (
                  [...maskedPreview].map((char, index) => (
                    <span key={index} className={char === "•" ? "mask" : "rev"}>
                      {char}
                    </span>
                  ))
                ) : (
                  <span className="mask">{t.createSecretPlaceholder}</span>
                )}
              </div>
            </div>
            <div className="progress" style={{ marginBottom: 0 }}>
              {Array.from({ length: challengeCount }).map((_, index) => (
                <i key={index} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
