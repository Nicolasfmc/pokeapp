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
} from "@mantine/core";
import type { DeckDto } from "./types";
import { DeckCoverPicker } from "./DeckCoverPicker";
import { CardArt } from "@/modules/cards/ui/CardImage";

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
  const [coverDeckId, setCoverDeckId] = useState<string | null>(null);
  const coverDeck = decks.find((d) => d.id === coverDeckId) ?? null;

  async function onDelete(deckId: string) {
    setError(null);
    setPendingId(deckId);
    try {
      const response = await fetch(`/api/decks/${deckId}`, { method: "DELETE" });
      const data = (await response.json()) as { error?: string; archived?: boolean };
      if (!response.ok) {
        setError(data.error ?? "Falha ao excluir deck.");
        setPendingId(null);
        return;
      }
      if (data.archived) {
        // Deck com partidas registradas é arquivado, não apagado (§114).
        setDecks((prev) =>
          prev.map((d) =>
            d.id === deckId
              ? {
                  ...d,
                  physicalStatus: "NOT_SLEEVED",
                  tags: d.tags.includes("ARCHIVED") ? d.tags : [...d.tags, "ARCHIVED"],
                }
              : d,
          ),
        );
        setError("Deck possui partidas registradas e foi arquivado em vez de excluído.");
      } else {
        setDecks((prev) => prev.filter((d) => d.id !== deckId));
      }
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {decks.map((deck) => (
            <div
              key={deck.id}
              className="flex flex-col overflow-hidden rounded-xl border border-[var(--poke-line)] bg-[var(--poke-panel)]/85 transition-colors hover:border-[var(--poke-accent)]"
            >
              <Link
                href={`/decks/${deck.id}`}
                aria-label={`Abrir ${deck.name}`}
                className="block"
              >
                <CardArt src={deck.coverImageUrl} alt={`Capa de ${deck.name}`} />
              </Link>
              <Stack gap={6} p="sm" style={{ flex: 1 }}>
                <Text
                  component={Link}
                  href={`/decks/${deck.id}`}
                  fw={700}
                  lineClamp={1}
                  className="text-[var(--poke-ink)] no-underline hover:underline"
                >
                  {deck.name}
                </Text>
                <Group gap={6} wrap="wrap">
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
                <Text size="sm" c="dimmed" lineClamp={2}>
                  {deck.cardCount} cartas
                  {deck.description ? ` · ${deck.description}` : ""}
                </Text>
                <Group gap="xs" mt="auto" pt={4}>
                  <Button
                    component={Link}
                    href={`/decks/${deck.id}`}
                    variant="subtle"
                    size="compact-sm"
                  >
                    Editar
                  </Button>
                  <Button
                    variant="subtle"
                    size="compact-sm"
                    onClick={() => setCoverDeckId(deck.id)}
                  >
                    Capa
                  </Button>
                  <Button
                    variant="subtle"
                    color="red"
                    size="compact-sm"
                    aria-label={`Excluir ${deck.name}`}
                    loading={pendingId === deck.id}
                    onClick={() => onDelete(deck.id)}
                  >
                    Excluir
                  </Button>
                </Group>
              </Stack>
            </div>
          ))}
        </div>
      )}
      {coverDeck ? (
        <DeckCoverPicker
          deck={coverDeck}
          opened
          onClose={() => setCoverDeckId(null)}
          onChange={(next) =>
            setDecks((prev) => prev.map((d) => (d.id === next.id ? next : d)))
          }
        />
      ) : null}
    </Stack>
  );
}
