"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { SealMark } from "@/components/SealMark";
import { TopBar } from "@/components/TopBar";
import { getMessages, resolveUiLocale, storeUiLocale } from "@/lib/i18n";
import { ROOM_CODE_ALPHABET } from "@/lib/types";
import type { Locale } from "@/lib/types";

/** Static phone preview used only on the landing hero (RR-UI-002). */
function HeroPhone({ variant, locale }: { variant: "lobby" | "challenge"; locale: Locale }) {
  const t = getMessages(locale);
  if (variant === "challenge") {
    return (
      <div className="phone a" aria-hidden="true">
        <div className="screen">
          <div className="mini-top">
            <div className="mini-brand">
              <span className="seal">
                <SealMark variant="solid" size={12} />
              </span>
              Reveal Room
            </div>
            <div className="pill">K7P4XM</div>
          </div>
          <div className="challenge">
            <small>{t.yourTurn}</small>
            <h4>{t.puzzleOddTitle}</h4>
          </div>
          <div className="tiles">
            {["◆", "◆", "◆", "◆", "◇", "◆", "◆", "◆", "◆"].map((glyph, i) => (
              <div key={i} className={`tile${i === 4 ? " hot" : ""}`}>
                {glyph}
              </div>
            ))}
          </div>
          <div className="progress">
            <i className="done" />
            <i className="done" />
            <i className="current" />
            <i />
            <i />
          </div>
          <div className="secret-card">
            <div className="label">{t.secretLabel}</div>
            <div className="secret">
              <span className="rev">A</span>
              <span className="mask">••</span>
              <span className="rev">Z</span>
              <span className="mask">•••</span>-<span className="rev">9</span>
              <span className="mask">•••</span>-<span className="mask">•••••</span>
            </div>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="phone b" aria-hidden="true">
      <div className="screen">
        <div className="mini-top">
          <div className="mini-brand">
            <span className="seal">
              <SealMark variant="solid" size={12} />
            </span>
            Reveal Room
          </div>
          <div className="pill">{t.modeParty}</div>
        </div>
        <div className="lock">
          <SealMark variant="outline" size={36} />
        </div>
        <h3 className="center-title" style={{ fontSize: 19 }}>
          {t.createTitlePlaceholder}
        </h3>
        <div className="secret-card">
          <div className="label">{t.revealPreviewLabel}</div>
          <div className="secret">
            <span className="mask">••••••••••••••••</span>
          </div>
        </div>
        <div className="players">
          {["AL", "CR", "MA"].map((initials, i) => (
            <div key={i} className="player">
              <span className="person">
                <span className="avatar">{initials}</span>
                <b>
                  {t.playerWord} {i + 1}
                </b>
              </span>
              <span className="online" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function LandingPage() {
  const router = useRouter();
  const [locale, setLocale] = useState<Locale>(() => resolveUiLocale());
  const [joinOpen, setJoinOpen] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [joinError, setJoinError] = useState<string | null>(null);
  const t = useMemo(() => getMessages(locale), [locale]);

  const changeLocale = (next: Locale) => {
    setLocale(next);
    storeUiLocale(next);
  };

  const submitJoin = (event: React.FormEvent) => {
    event.preventDefault();
    const normalized = joinCode
      .toUpperCase()
      .split("")
      .filter((ch) => ROOM_CODE_ALPHABET.includes(ch))
      .join("")
      .slice(0, 6);
    if (normalized.length !== 6) {
      setJoinError(t.joinInvalidCode);
      return;
    }
    setJoinError(null);
    router.push(`/r/${normalized}`);
  };

  return (
    <div className="wrap">
      <TopBar t={t} locale={locale} onLocaleChange={changeLocale} />

      <section className="hero">
        <div>
          <h1>
            {t.landingHeadline} <span className="accent">{t.landingHeadlineAccent}</span>
          </h1>
          <p>{t.landingSub}</p>
          <div className="actions">
            <Button variant="primary" onClick={() => router.push("/create")}>
              {t.createCta}
            </Button>
            <Button variant="secondary" onClick={() => setJoinOpen((open) => !open)}>
              {t.joinWithCode}
            </Button>
          </div>
          {joinOpen ? (
            <form onSubmit={submitJoin} className="join-area" style={{ marginTop: 16 }}>
              <label className="visually-hidden" htmlFor="join-code">
                {t.joinCodeLabel}
              </label>
              <div className="join-box">
                <input
                  id="join-code"
                  inputMode="text"
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  maxLength={6}
                  placeholder={t.joinCodePlaceholder}
                  value={joinCode}
                  onChange={(event) => {
                    setJoinCode(
                      event.target.value
                        .toUpperCase()
                        .split("")
                        .filter((ch) => ROOM_CODE_ALPHABET.includes(ch))
                        .join("")
                        .slice(0, 6),
                    );
                    setJoinError(null);
                  }}
                />
                <Button variant="primary" size="small" type="submit">
                  {t.joinCodeButton}
                </Button>
              </div>
              {joinError !== null ? <div className="join-err">{joinError}</div> : null}
            </form>
          ) : null}
          <div className="note">
            <b>●</b> {t.note}
          </div>
        </div>
        <div className="stage">
          <div className="glow" />
          <HeroPhone variant="lobby" locale={locale} />
          <HeroPhone variant="challenge" locale={locale} />
        </div>
      </section>
    </div>
  );
}
