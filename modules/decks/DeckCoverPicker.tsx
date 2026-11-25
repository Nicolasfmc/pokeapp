"use client";

import { useState } from "react";
import { Alert, Button, Modal, Stack, Text } from "@mantine/core";
import { CardArt, CardImage } from "@/modules/cards/ui/CardImage";
import type { DeckDto } from "./types";
import { useI18n } from "@/lib/i18n/I18nProvider";

type Props = {
  deck: DeckDto;
  opened: boolean;
  onClose: () => void;
  onChange: (deck: DeckDto) => void;
};

/** Escolha da carta que representa o deck na lista (§ usabilidade: capa). */
export function DeckCoverPicker({ deck, opened, onClose, onChange }: Props) {
  const { t, te } = useI18n();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const choices = [...deck.cards]
    .filter((c) => c.printingId && c.imageUrl)
    .sort((a, b) => {
      // Pokémon primeiro: é o que costuma representar o deck.
      const rank = (c: typeof a) => (c.category === "POKEMON" ? 0 : 1);
      return rank(a) - rank(b) || a.canonicalName.localeCompare(b.canonicalName);
    });

  async function save(coverPrintingId: string | null) {
    setError(null);
    setPendingId(coverPrintingId ?? "default");
    try {
      const response = await fetch(`/api/decks/${deck.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ coverPrintingId }),
      });
      const data = (await response.json()) as { deck?: DeckDto; error?: string };
      if (!response.ok || !data.deck) {
        setError(te(data.error) ?? t("cover.saveFailed"));
        return;
      }
      onChange(data.deck);
      onClose();
    } catch {
      setError(t("cover.saveError"));
    } finally {
      setPendingId(null);
    }
  }

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={t("decks.coverOf", { name: deck.name })}
      size="xl"
      centered
    >
      <Stack gap="md">
        <div className="mx-auto w-full max-w-[240px] overflow-hidden sm:max-w-sm rounded-xl ring-1 ring-[var(--sb-line)]">
          <CardArt src={deck.coverImageUrl} alt={t("cover.current")} />
        </div>
        {error ? <Alert color="red">{error}</Alert> : null}
        {choices.length === 0 ? (
          <Text c="dimmed" size="sm">
            {t("cover.empty")}
          </Text>
        ) : (
          <>
            <Text size="sm" c="dimmed">
              {t("cover.hint")}
            </Text>
            <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-5 sm:gap-2 md:grid-cols-6">
              {choices.map((card) => {
                const selected = deck.coverPrintingId === card.printingId;
                return (
                  <button
                    key={card.logicalCardId}
                    type="button"
                    aria-label={t("cover.useAs", { name: card.canonicalName })}
                    disabled={pendingId !== null}
                    onClick={() => void save(card.printingId)}
                    className="cursor-pointer border-0 bg-transparent p-0 transition-transform hover:-translate-y-0.5 disabled:cursor-wait"
                  >
                    <CardImage
                      src={card.imageUrl}
                      alt={card.canonicalName}
                      sizes="120px"
                      className={selected ? "ring-4 ring-[var(--sb-accent)]" : ""}
                    />
                  </button>
                );
              })}
            </div>
          </>
        )}
        {deck.coverPrintingId ? (
          <Button
            variant="subtle"
            color="ink"
            loading={pendingId === "default"}
            onClick={() => void save(null)}
          >
            {t("cover.auto")}
          </Button>
        ) : null}
      </Stack>
    </Modal>
  );
}
