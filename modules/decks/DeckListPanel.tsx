"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, startTransition } from "react";
import {
  Badge,
  Button,
  Group,
  Stack,
  Text,
  Title,
  ActionIcon,
} from "@mantine/core";
import type { DeckDto } from "./types";

const TAG_LABELS: Record<string, string> = {
  FAVORITE: "Favorito",
  TESTING: "Testando",
  ARCHIVED: "Arquivado",
};

const IMPORT_LABELS: Record<string, string> = {
  IMPORTED: "Importado",
  PARTIALLY_RESOLVED: "Parcial",
  READY: "Pronto",
  INVALID: "Inválido",
};

export function DeckListPanel({ initialDecks }: { initialDecks: DeckDto[] }) {
  const router = useRouter();
  const [decks, setDecks] = useState(initialDecks);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  async function onDelete(deckId: string) {
    setError(null);
    setPendingId(deckId);
    try {
      const response = await fetch(`/api/decks/${deckId}`, { method: "DELETE" });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "Falha ao excluir deck.");
        setPendingId(null);
        return;
      }
      setDecks((prev) => prev.filter((d) => d.id !== deckId));
      setPendingId(null);
      startTransition(() => router.refresh());
    } catch {
      setError("Não foi possível excluir o deck.");
      setPendingId(null);
    }
  }

  return (
    <Stack gap="lg" className="max-w-5xl animate-[poke-rise_0.45s_ease-out]">
      <Group justify="space-between" align="flex-end">
        <div>
          <Title order={2}>Decks</Title>
          <Text c="dimmed" size="sm" mt={4}>
            Construa listas lógicas por formato. Sem alocação física nesta tela.
          </Text>
        </div>
        <Group gap="sm">
          <Button component={Link} href="/decks/import" variant="light">
            Importar Limitless
          </Button>
          <Button component={Link} href="/decks/new">
            Novo deck
          </Button>
        </Group>
      </Group>

      {error ? (
        <Text c="red" size="sm">
          {error}
        </Text>
      ) : null}

      {decks.length === 0 ? (
        <Stack
          gap="sm"
          className="rounded-xl border border-[var(--poke-line)] bg-[var(--poke-panel)]/80 px-6 py-10"
        >
          <Text fw={600}>Nenhum deck ainda</Text>
          <Text c="dimmed" size="sm">
            Crie um deck do zero ou importe uma lista Limitless.
          </Text>
          <Group gap="sm" mt="xs">
            <Button component={Link} href="/decks/new">
              Criar deck
            </Button>
            <Button component={Link} href="/decks/import" variant="light">
              Importar
            </Button>
          </Group>
        </Stack>
      ) : (
        <Stack gap="sm">
          {decks.map((deck) => (
            <Group
              key={deck.id}
              justify="space-between"
              align="center"
              wrap="nowrap"
              className="rounded-xl border border-[var(--poke-line)] bg-[var(--poke-panel)]/85 px-4 py-3 transition-colors hover:border-[var(--poke-accent)]"
            >
              <Stack gap={4} style={{ minWidth: 0, flex: 1 }}>
                <Group gap="sm" wrap="wrap">
                  <Text
                    component={Link}
                    href={`/decks/${deck.id}`}
                    fw={700}
                    className="text-[var(--poke-ink)] no-underline hover:underline"
                  >
                    {deck.name}
                  </Text>
                  <Badge variant="light" color="ink">
                    {deck.format.name}
                  </Badge>
                  <Badge
                    variant="light"
                    color={deck.physicalStatus === "SLEEVED" ? "green" : "gray"}
                  >
                    {deck.physicalStatus === "SLEEVED" ? "SLEEVED" : "NOT_SLEEVED"}
                  </Badge>
                  {deck.importStatus ? (
                    <Badge variant="outline" color="ember">
                      {IMPORT_LABELS[deck.importStatus] ?? deck.importStatus}
                    </Badge>
                  ) : null}
                  {deck.tags.map((tag) => (
                    <Badge key={tag} variant="dot" color="gray">
                      {TAG_LABELS[tag] ?? tag}
                    </Badge>
                  ))}
                </Group>
                <Text size="sm" c="dimmed">
                  {deck.cardCount} cartas
                  {deck.description ? ` · ${deck.description}` : ""}
                </Text>
              </Stack>
              <Group gap="xs" wrap="nowrap">
                <Button
                  component={Link}
                  href={`/decks/${deck.id}`}
                  variant="subtle"
                  size="compact-sm"
                >
                  Editar
                </Button>
                <ActionIcon
                  variant="subtle"
                  color="red"
                  aria-label={`Excluir ${deck.name}`}
                  loading={pendingId === deck.id}
                  onClick={() => onDelete(deck.id)}
                >
                  <span className="text-xs font-semibold">Excluir</span>
                </ActionIcon>
              </Group>
            </Group>
          ))}
        </Stack>
      )}
    </Stack>
  );
}
