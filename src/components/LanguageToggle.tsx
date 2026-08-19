"use client";

import type { Locale } from "@/lib/types";
import type { Messages } from "@/lib/i18n";

interface LanguageToggleProps {
  locale: Locale;
  onChange: (locale: Locale) => void;
  t: Messages;
}

/** EN / IT segmented toggle (RR-UI-001). */
export function LanguageToggle({ locale, onChange, t }: LanguageToggleProps) {
  return (
    <div className="langs" role="group" aria-label={t.langToggleLabel}>
      <button
        type="button"
        className={`lang-btn${locale === "en" ? " on" : ""}`}
        aria-pressed={locale === "en"}
        onClick={() => onChange("en")}
      >
        EN
      </button>
      <button
        type="button"
        className={`lang-btn${locale === "it" ? " on" : ""}`}
        aria-pressed={locale === "it"}
        onClick={() => onChange("it")}
      >
        IT
      </button>
    </div>
  );
}
