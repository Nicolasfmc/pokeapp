import type { Locale } from "./config";
import { DISPLAY_TIME_ZONE, intlLocale } from "./config";
import { messages, type MessageKey } from "./messages";
import { translateServerMessage } from "./server-messages";

export type TranslateVars = Record<string, string | number>;
export type TFunction = (key: MessageKey, vars?: TranslateVars) => string;

function interpolate(template: string, vars?: TranslateVars) {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  );
}

export function createT(locale: Locale): TFunction {
  const index = locale === "pt-BR" ? 1 : 0;
  return (key, vars) => {
    const entry = messages[key];
    return interpolate(entry ? entry[index] : key, vars);
  };
}

export function hasMessage(key: string): key is MessageKey {
  return Object.prototype.hasOwnProperty.call(messages, key);
}

/**
 * Label for an enum-like value (e.g. sleeve status, format code). Falls back
 * to the raw value when no translation exists.
 */
export function createEnumT(t: TFunction) {
  return (group: string, value: string | null | undefined) => {
    if (value == null) return "";
    const key = `${group}.${value}`;
    return hasMessage(key) ? t(key) : value;
  };
}

export type Translator = {
  locale: Locale;
  t: TFunction;
  /** Enum label: tEnum("sleeveStatus", "NOT_SLEEVED"). */
  tEnum: (group: string, value: string | null | undefined) => string;
  /** Translate an error message returned by the API (written in Portuguese). */
  te: (message: string | null | undefined) => string | undefined;
  formatDate: (value: string | Date) => string;
  formatDateTime: (value: string | Date) => string;
  formatNumber: (value: number) => string;
};

export function createTranslator(locale: Locale): Translator {
  const t = createT(locale);
  const intl = intlLocale(locale);
  return {
    locale,
    t,
    tEnum: createEnumT(t),
    te: (message) => (message ? translateServerMessage(locale, message) : undefined),
    // Date-only values are stored at midnight UTC: format them in UTC.
    formatDate: (value) =>
      new Date(value).toLocaleDateString(intl, { timeZone: "UTC" }),
    formatDateTime: (value) =>
      new Date(value).toLocaleString(intl, { timeZone: DISPLAY_TIME_ZONE }),
    formatNumber: (value) => value.toLocaleString(intl),
  };
}
