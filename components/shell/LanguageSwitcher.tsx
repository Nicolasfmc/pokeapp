"use client";

import { Button, Menu } from "@mantine/core";
import BR from "country-flag-icons/react/3x2/BR";
import US from "country-flag-icons/react/3x2/US";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { Locale } from "@/lib/i18n/config";

const OPTIONS: { locale: Locale; label: string; short: string; Flag: typeof BR }[] = [
  { locale: "en", label: "English", short: "EN", Flag: US },
  { locale: "pt-BR", label: "Português (Brasil)", short: "PT", Flag: BR },
];

function FlagIcon({ Flag }: { Flag: typeof BR }) {
  return <Flag style={{ width: 18, height: 12, borderRadius: 2 }} aria-hidden />;
}

export function LanguageSwitcher() {
  const { locale, setLocale, t } = useI18n();
  const current = OPTIONS.find((o) => o.locale === locale) ?? OPTIONS[0];

  return (
    <Menu position="bottom-end" withinPortal shadow="md">
      <Menu.Target>
        <Button
          variant="subtle"
          color="ink"
          size="compact-sm"
          aria-label={t("shell.language")}
          leftSection={<FlagIcon Flag={current.Flag} />}
        >
          {current.short}
        </Button>
      </Menu.Target>
      <Menu.Dropdown>
        {OPTIONS.map((option) => (
          <Menu.Item
            key={option.locale}
            leftSection={<FlagIcon Flag={option.Flag} />}
            onClick={() => option.locale !== locale && setLocale(option.locale)}
            fw={option.locale === locale ? 700 : undefined}
          >
            {option.label}
          </Menu.Item>
        ))}
      </Menu.Dropdown>
    </Menu>
  );
}
