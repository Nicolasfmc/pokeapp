"use client";

import { MantineProvider } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import { mantineTheme } from "@/components/theme/mantine-theme";
import { I18nProvider } from "@/lib/i18n/I18nProvider";
import type { Locale } from "@/lib/i18n/config";

export function AppProviders({
  locale,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
  return (
    <MantineProvider theme={mantineTheme} defaultColorScheme="light">
      <I18nProvider initialLocale={locale}>
        <Notifications position="top-right" zIndex={4000} />
        {children}
      </I18nProvider>
    </MantineProvider>
  );
}
