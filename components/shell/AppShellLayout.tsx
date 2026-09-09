"use client";

import Link from "next/link";
import { AppShell, Burger, Group, Text, ActionIcon, useMantineColorScheme } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { AppNav } from "@/components/shell/AppNav";

function ColorSchemeToggle() {
  const { colorScheme, setColorScheme } = useMantineColorScheme();
  const next = colorScheme === "dark" ? "light" : "dark";

  return (
    <ActionIcon
      variant="subtle"
      color="ink"
      aria-label={next === "dark" ? "Ativar tema escuro" : "Ativar tema claro"}
      onClick={() => setColorScheme(next)}
    >
      <span className="text-sm font-semibold tracking-wide">
        {colorScheme === "dark" ? "Claro" : "Escuro"}
      </span>
    </ActionIcon>
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
      <AppShell.Header className="border-b border-[var(--poke-line)] bg-[var(--poke-header)]/90 backdrop-blur-md">
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
              className="font-[family-name:var(--font-space-grotesk)] text-xl font-bold tracking-tight text-[var(--poke-ink)] no-underline"
            >
              PokeApp
            </Text>
          </Group>
          <ColorSchemeToggle />
        </Group>
      </AppShell.Header>

      <AppShell.Navbar className="border-r border-[var(--poke-line)] bg-[var(--poke-nav)]">
        <AppShell.Section grow>
          <AppNav onNavigate={close} />
        </AppShell.Section>
      </AppShell.Navbar>

      <AppShell.Main className="bg-transparent">{children}</AppShell.Main>
    </AppShell>
  );
}
