"use client";

import Link from "next/link";
import { AppShell, Box, Burger, Button, Group, Text, useMantineColorScheme } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { AppNav } from "@/components/shell/AppNav";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { LanguageSwitcher } from "@/components/shell/LanguageSwitcher";

// Labels must not depend on the color scheme during render: the server always
// renders light, so a dark user would get a hydration mismatch (which forces a
// client re-render and leaves duplicated Mantine styles, e.g. a stuck navbar).
// Both labels are rendered and CSS (lightHidden/darkHidden) shows the right one.
function ColorSchemeToggle() {
  const { toggleColorScheme } = useMantineColorScheme();
  const { t } = useI18n();

  return (
    <Button
      variant="subtle"
      color="ink"
      size="compact-sm"
      aria-label={t("shell.toggleTheme")}
      onClick={toggleColorScheme}
    >
      <Box component="span" lightHidden>
        {t("shell.lightTheme")}
      </Box>
      <Box component="span" darkHidden>
        {t("shell.darkTheme")}
      </Box>
    </Button>
  );
}

export function AppShellLayout({
  children,
  isAdmin = false,
}: {
  children: React.ReactNode;
  isAdmin?: boolean;
}) {
  const [opened, { toggle, close }] = useDisclosure(false);
  const { t } = useI18n();

  return (
    <AppShell
      header={{ height: 64 }}
      navbar={{
        width: 260,
        breakpoint: "sm",
        collapsed: { mobile: !opened },
      }}
      padding="md"
      className="min-h-screen"
    >
      <AppShell.Header className="border-b border-[var(--sb-line)] bg-[var(--sb-header)]/90 backdrop-blur-md">
        <Group h="100%" px="md" justify="space-between">
          <Group gap="sm">
            <Burger
              opened={opened}
              onClick={toggle}
              hiddenFrom="sm"
              size="sm"
              aria-label={t("shell.openNav")}
            />
            <Text
              component={Link}
              href="/"
              onClick={close}
              className="font-[family-name:var(--font-space-grotesk)] text-xl font-bold tracking-tight text-[var(--sb-ink)] no-underline"
            >
              SleeveBuild
            </Text>
          </Group>
          <Group gap={4} wrap="nowrap">
            <LanguageSwitcher />
            <ColorSchemeToggle />
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar className="border-r border-[var(--sb-line)] bg-[var(--sb-nav)]">
        <AppShell.Section grow>
          <AppNav onNavigate={close} isAdmin={isAdmin} />
        </AppShell.Section>
      </AppShell.Navbar>

      <AppShell.Main className="bg-transparent">{children}</AppShell.Main>
    </AppShell>
  );
}
