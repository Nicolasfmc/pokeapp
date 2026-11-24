"use client";

import { useState } from "react";
import { Alert, Button, Modal, Stack, Text } from "@mantine/core";
import { CardArt, CardImage } from "@/modules/cards/ui/CardImage";
import type { DeckDto } from "./types";

type Props = {
  deck: DeckDto;
  opened: boolean;
  onClose: () => void;
  onChange: (deck: DeckDto) => void;
};

/** Escolha da carta que representa o deck na lista (§ usabilidade: capa). */
export function DeckCoverPicker({ deck, opened, onClose, onChange }: Props) {
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
        setError(data.error ?? "Falha ao salvar a capa.");
        return;
      }
      onChange(data.deck);
      onClose();
    } catch {
      setError("Não foi possível salvar a capa.");
    } finally {
      setPendingId(null);
    }
  }

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={`Capa de ${deck.name}`}
      size="xl"
      centered
    >
      <Stack gap="md">
        <div className="mx-auto w-full max-w-sm overflow-hidden rounded-xl ring-1 ring-[var(--poke-line)]">
          <CardArt src={deck.coverImageUrl} alt="Capa atual" />
        </div>
        {error ? <Alert color="red">{error}</Alert> : null}
        {choices.length === 0 ? (
          <Text c="dimmed" size="sm">
            Adicione cartas ao deck para escolher uma capa.
          </Text>
        ) : (
          <>
            <Text size="sm" c="dimmed">
              Clique numa carta do deck. Na lista aparece só a arte do Pokémon.
            </Text>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 md:grid-cols-6">
              {choices.map((card) => {
                const selected = deck.coverPrintingId === card.printingId;
                return (
                  <button
                    key={card.logicalCardId}
                    type="button"
                    aria-label={`Usar ${card.canonicalName} como capa`}
                    disabled={pendingId !== null}
                    onClick={() => void save(card.printingId)}
                    className="cursor-pointer border-0 bg-transparent p-0 transition-transform hover:-translate-y-0.5 disabled:cursor-wait"
                  >
                    <CardImage
                      src={card.imageUrl}
                      alt={card.canonicalName}
                      sizes="120px"
                      className={selected ? "ring-4 ring-[var(--poke-accent)]" : ""}
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
            Voltar à capa automática
          </Button>
        ) : null}
      </Stack>
    </Modal>
  );
}
