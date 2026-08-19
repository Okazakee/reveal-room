"use client";

import Link from "next/link";
import { LanguageToggle } from "@/components/LanguageToggle";
import { SealMark } from "@/components/SealMark";
import type { Messages } from "@/lib/i18n";
import type { Locale } from "@/lib/types";

interface TopBarProps {
  t: Messages;
  locale: Locale;
  onLocaleChange: (locale: Locale) => void;
  /** Optional trailing pill (e.g. the room code on room pages). */
  right?: React.ReactNode;
}

/**
 * Compact floating sticky top bar from the showroom. Full variant is used on
 * public pages; `right` can replace the nav actions (room pages pass a
 * code pill instead of marketing-style nav).
 */
export function TopBar({ t, locale, onLocaleChange, right }: TopBarProps) {
  return (
    <header className="top">
      <Link href="/" className="brand">
        <span className="seal">
          <SealMark variant="solid" size={18} />
        </span>
        {t.appName}
      </Link>
      <div className="top-actions">
        {right}
        <LanguageToggle locale={locale} onChange={onLocaleChange} t={t} />
      </div>
    </header>
  );
}
