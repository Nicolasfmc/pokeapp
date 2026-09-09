"use client";

import { MantineProvider } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import { mantineTheme } from "@/components/theme/mantine-theme";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <MantineProvider theme={mantineTheme} defaultColorScheme="light">
      <Notifications position="top-right" zIndex={4000} />
      {children}
    </MantineProvider>
  );
}
