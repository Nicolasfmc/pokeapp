"use client";

import Link from "next/link";
import { AppShell, Box, Burger, Button, Group, Text, useMantineColorScheme } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { AppNav } from "@/components/shell/AppNav";

// Labels must not depend on the color scheme during render: the server always
// renders light, so a dark user would get a hydration mismatch (which forces a
// client re-render and leaves duplicated Mantine styles, e.g. a stuck navbar).
// Both labels are rendered and CSS (lightHidden/darkHidden) shows the right one.
function ColorSchemeToggle() {
  const { toggleColorScheme } = useMantineColorScheme();

  return (
    <Button
      variant="subtle"
      color="ink"
      size="compact-sm"
      aria-label="Alternar tema claro/escuro"
      onClick={toggleColorScheme}
    >
      <Box component="span" lightHidden>
        Tema claro
      </Box>
      <Box component="span" darkHidden>
        Tema escuro
      </Box>
    </Button>
  );
}

export function AppShellLayout({ children }: { children: React.ReactNode }) {
  const [opened, { toggle, close }] = useDisclosure(false);

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
              aria-label="Abrir navegação"
            />
            <Text
              component={Link}
              href="/"
              className="font-[family-name:var(--font-space-grotesk)] text-xl font-bold tracking-tight text-[var(--sb-ink)] no-underline"
            >
              SleeveBuild
            </Text>
          </Group>
          <ColorSchemeToggle />
        </Group>
      </AppShell.Header>

      <AppShell.Navbar className="border-r border-[var(--sb-line)] bg-[var(--sb-nav)]">
        <AppShell.Section grow>
          <AppNav onNavigate={close} />
        </AppShell.Section>
      </AppShell.Navbar>

      <AppShell.Main className="bg-transparent">{children}</AppShell.Main>
    </AppShell>
  );
}
