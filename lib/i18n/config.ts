export const LOCALES = ["en", "pt-BR"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "sb_locale";

/** Time zone used for date-times shown in the UI (server renders in UTC). */
export const DISPLAY_TIME_ZONE = "America/Sao_Paulo";

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

export function resolveLocale(value: unknown): Locale {
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

/** BCP 47 tag for Intl formatters. */
export function intlLocale(locale: Locale) {
  return locale === "pt-BR" ? "pt-BR" : "en-US";
}
