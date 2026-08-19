import { en, type Messages } from "@/lib/i18n/en";
import { it } from "@/lib/i18n/it";
import type { Locale } from "@/lib/types";

export type { Messages } from "@/lib/i18n/en";

export const dictionaries: Record<Locale, Messages> = { en, it };

/** Interpolate `{param}` placeholders. Unknown placeholders stay literal. */
export function format(template: string, params: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in params ? String(params[key]) : match,
  );
}

export function getMessages(locale: Locale): Messages {
  return dictionaries[locale];
}

export function isLocale(value: string | null | undefined): value is Locale {
  return value === "en" || value === "it";
}

const STORAGE_KEY = "reveal-room:lang";

/**
 * RR-I18N-003: stored user preference wins; otherwise browser language
 * (`it*` → Italian, everything else → English).
 */
export function resolveUiLocale(): Locale {
  if (typeof window === "undefined") return "en";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (isLocale(stored)) return stored;
  const browser = window.navigator.language.toLowerCase();
  return browser.startsWith("it") ? "it" : "en";
}

export function storeUiLocale(locale: Locale): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    // Storage unavailable (private mode); preference simply won't persist.
  }
}
