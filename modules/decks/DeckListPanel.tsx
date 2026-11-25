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
import { CardArt, CardImage } from "@/modules/cards/ui/CardImage";
import { useI18n } from "@/lib/i18n/I18nProvider";

export function DeckListPanel({ initialDecks }: { initialDecks: DeckDto[] }) {
  const router = useRouter();
  const { t, te, tEnum } = useI18n();
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
        setError(te(data.error) ?? t("decks.deleteFailed"));
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
        setError(t("decks.archivedInstead"));
      } else {
        setDecks((prev) => prev.filter((d) => d.id !== deckId));
      }
      setPendingId(null);
      startTransition(() => router.refresh());
    } catch {
      setError(t("decks.deleteError"));
      setPendingId(null);
    }
  }

  return (
    <Stack gap="lg" className="max-w-5xl animate-[sb-rise_0.45s_ease-out]">
      <Group justify="space-between" align="flex-end">
        <div>
          <Title order={2}>{t("decks.title")}</Title>
          <Text c="dimmed" size="sm" mt={4}>
            {t("decks.subtitle")}
          </Text>
        </div>
        <Group gap="sm">
          <Button component={Link} href="/decks/import" variant="light">
            {t("decks.importLimitless")}
          </Button>
          <Button component={Link} href="/decks/new">
            {t("decks.newDeck")}
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
          className="rounded-xl border border-[var(--sb-line)] bg-[var(--sb-panel)]/80 px-6 py-10"
        >
          <Text fw={600}>{t("decks.noDecks")}</Text>
          <Text c="dimmed" size="sm">
            {t("decks.noDecksHint")}
          </Text>
          <Group gap="sm" mt="xs">
            <Button component={Link} href="/decks/new">
              {t("decks.createDeck")}
            </Button>
            <Button component={Link} href="/decks/import" variant="light">
              {t("decks.import")}
            </Button>
          </Group>
        </Stack>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {decks.map((deck) => (
            <div
              key={deck.id}
              className="flex flex-row overflow-hidden rounded-xl border sm:flex-col border-[var(--sb-line)] bg-[var(--sb-panel)]/85 transition-colors hover:border-[var(--sb-accent)]"
            >
              <Link
                href={`/decks/${deck.id}`}
                aria-label={t("decks.open", { name: deck.name })}
                className="my-2 ml-2 block w-28 shrink-0 self-start sm:m-0 sm:w-auto sm:self-auto"
              >
                <div className="sm:hidden">
                  <CardImage
                    src={deck.coverImageUrl}
                    alt={t("decks.coverOf", { name: deck.name })}
                    sizes="112px"
                  />
                </div>
                <div className="hidden sm:block">
                  <CardArt src={deck.coverImageUrl} alt={t("decks.coverOf", { name: deck.name })} />
                </div>
              </Link>
              <Stack gap={6} p="sm" style={{ flex: 1, minWidth: 0 }}>
                <Text
                  component={Link}
                  href={`/decks/${deck.id}`}
                  fw={700}
                  lineClamp={1}
                  className="text-[var(--sb-ink)] no-underline hover:underline"
                >
                  {deck.name}
                </Text>
                <Group gap={6} wrap="wrap">
                  <Badge variant="light" color="ink">
                    {tEnum("format", deck.format.name)}
                  </Badge>
                  <Badge
                    variant="light"
                    color={deck.physicalStatus === "SLEEVED" ? "green" : "gray"}
                  >
                    {tEnum("physicalStatus", deck.physicalStatus)}
                  </Badge>
                  {deck.importStatus ? (
                    <Badge variant="outline" color="ember">
                      {tEnum("importStatus", deck.importStatus)}
                    </Badge>
                  ) : null}
                  {deck.tags.map((tag) => (
                    <Badge key={tag} variant="dot" color="gray">
                      {tEnum("deckTag", tag)}
                    </Badge>
                  ))}
                </Group>
                <Text size="sm" c="dimmed" lineClamp={2}>
                  {t("common.cards", { count: deck.cardCount })}
                  {deck.description ? ` · ${deck.description}` : ""}
                </Text>
                <Group gap="xs" mt="auto" pt={4}>
                  <Button
                    component={Link}
                    href={`/decks/${deck.id}`}
                    variant="subtle"
                    size="compact-sm"
                  >
                    {t("common.edit")}
                  </Button>
                  <Button
                    variant="subtle"
                    size="compact-sm"
                    onClick={() => setCoverDeckId(deck.id)}
                  >
                    {t("decks.cover")}
                  </Button>
                  <Button
                    variant="subtle"
                    color="red"
                    size="compact-sm"
                    aria-label={t("decks.deleteNamed", { name: deck.name })}
                    loading={pendingId === deck.id}
                    onClick={() => onDelete(deck.id)}
                  >
                    {t("common.delete")}
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
