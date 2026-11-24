"use client";

import { Group, Select, Text } from "@mantine/core";
import BR from "country-flag-icons/react/3x2/BR";
import US from "country-flag-icons/react/3x2/US";
import ES from "country-flag-icons/react/3x2/ES";
import FR from "country-flag-icons/react/3x2/FR";
import DE from "country-flag-icons/react/3x2/DE";
import IT from "country-flag-icons/react/3x2/IT";
import JP from "country-flag-icons/react/3x2/JP";
import KR from "country-flag-icons/react/3x2/KR";
import TW from "country-flag-icons/react/3x2/TW";
import CN from "country-flag-icons/react/3x2/CN";
import ID from "country-flag-icons/react/3x2/ID";
import TH from "country-flag-icons/react/3x2/TH";

type Flag = typeof BR;

/** Idiomas de impressão de cartas físicas (código salvo no Inventory). */
export const CARD_LANGUAGES: Array<{ value: string; label: string; flag: Flag }> = [
  { value: "pt", label: "Português", flag: BR },
  { value: "en", label: "English", flag: US },
  { value: "es", label: "Español", flag: ES },
  { value: "fr", label: "Français", flag: FR },
  { value: "de", label: "Deutsch", flag: DE },
  { value: "it", label: "Italiano", flag: IT },
  { value: "ja", label: "日本語", flag: JP },
  { value: "ko", label: "한국어", flag: KR },
  { value: "zh-tw", label: "繁體中文", flag: TW },
  { value: "zh-cn", label: "简体中文", flag: CN },
  { value: "id", label: "Bahasa Indonesia", flag: ID },
  { value: "th", label: "ไทย", flag: TH },
];

export const DEFAULT_CARD_LANGUAGE = "pt";

const BY_CODE = new Map(CARD_LANGUAGES.map((l) => [l.value, l]));

export function LanguageFlag({
  code,
  width = 20,
}: {
  code: string;
  width?: number;
}) {
  const language = BY_CODE.get(code.toLowerCase());
  if (!language) {
    return (
      <Text span size="xs" fw={600} tt="uppercase">
        {code}
      </Text>
    );
  }
  const Icon = language.flag;
  return (
    <Icon
      title={language.label}
      style={{ width, height: (width * 2) / 3 }}
      className="inline-block shrink-0 rounded-[2px] shadow-[0_0_0_1px_rgba(0,0,0,0.15)]"
    />
  );
}

export function LanguageSelect({
  value,
  onChange,
  label = "Idioma",
}: {
  value: string;
  onChange: (code: string) => void;
  label?: string;
}) {
  return (
    <Select
      label={label}
      data={CARD_LANGUAGES.map(({ value: v, label: l }) => ({ value: v, label: l }))}
      value={value}
      onChange={(next) => onChange(next ?? DEFAULT_CARD_LANGUAGE)}
      allowDeselect={false}
      leftSection={<LanguageFlag code={value} />}
      renderOption={({ option }) => (
        <Group gap="xs" wrap="nowrap">
          <LanguageFlag code={option.value} />
          <span>{option.label}</span>
        </Group>
      )}
    />
  );
}
