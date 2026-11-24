"use client";

import { useEffect, useState } from "react";
import {
  Badge,
  Checkbox,
  Group,
  Loader,
  SegmentedControl,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import type { CardCategory } from "@prisma/client";
import { CardImage } from "@/modules/cards/ui/CardImage";

type LogicalResult = {
  id: string;
  canonicalName: string;
  category: CardCategory;
  printingCount?: number;
  imageUrl?: string | null;
  representativePrintingId?: string | null;
};

export type DeckSearchPick = {
  logicalCardId: string;
  canonicalName: string;
  category: CardCategory;
  imageUrl: string | null;
  printingId: string | null;
};

type Props = {
  formatCode: string;
  /** Quantidade atual no deck por logicalCardId (badge na imagem). */
  quantities?: Record<string, number>;
  onAdd: (card: DeckSearchPick) => void;
};

/** §5.2 — busca de cartas no Deckbuilder (lê só PostgreSQL, nunca a TCGdex). */
export function DeckCardSearch({ formatCode, quantities = {}, onAdd }: Props) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("ALL");
  const [onlyLegal, setOnlyLegal] = useState(true);
  const [results, setResults] = useState<LogicalResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ mode: "logical", q: term, pageSize: "24" });
        if (category !== "ALL") params.set("category", category);
        const format = formatCode.toLowerCase();
        if (onlyLegal && (format === "standard" || format === "expanded")) {
          params.set("format", format);
        }
        const response = await fetch(`/api/cards/search?${params}`, {
          signal: controller.signal,
        });
        const data = (await response.json()) as { items?: LogicalResult[]; error?: string };
        if (!response.ok) {
          setError(data.error ?? "Falha na busca.");
          setResults([]);
        } else {
          setResults(data.items ?? []);
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") setError("Falha na busca.");
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, category, onlyLegal, formatCode]);

  const searching = query.trim().length >= 2;
  const visibleResults = searching ? results : [];

  return (
    <Stack
      gap="sm"
      className="rounded-xl border border-[var(--sb-line)] bg-[var(--sb-panel)]/85 p-4"
    >
      <Text fw={700}>Buscar carta</Text>
      <TextInput
        placeholder="Nome da carta (ex.: Buddy-Buddy Poffin)"
        value={query}
        onChange={(e) => setQuery(e.currentTarget.value)}
        rightSection={loading ? <Loader size="xs" /> : null}
      />
      <Group gap="sm" wrap="wrap">
        <SegmentedControl
          size="xs"
          value={category}
          onChange={setCategory}
          data={[
            { value: "ALL", label: "Todas" },
            { value: "POKEMON", label: "Pokémon" },
            { value: "TRAINER", label: "Trainer" },
            { value: "ENERGY", label: "Energy" },
          ]}
        />
        <Checkbox
          size="xs"
          label={`Somente legais em ${formatCode}`}
          checked={onlyLegal}
          onChange={(e) => setOnlyLegal(e.currentTarget.checked)}
        />
      </Group>
      {error ? (
        <Text size="sm" c="red">
          {error}
        </Text>
      ) : null}
      {searching && !loading && visibleResults.length === 0 && !error ? (
        <Text size="sm" c="dimmed">
          Nenhuma carta encontrada.
        </Text>
      ) : null}
      {visibleResults.length > 0 ? (
        <Text size="xs" c="dimmed">
          Clique na carta para adicionar 1 cópia.
        </Text>
      ) : null}
      <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-4 sm:gap-2 lg:grid-cols-6">
        {visibleResults.map((card) => {
          const inDeck = quantities[card.id] ?? 0;
          return (
            <button
              key={card.id}
              type="button"
              title={`Adicionar ${card.canonicalName}`}
              aria-label={`Adicionar ${card.canonicalName}`}
              className="group cursor-pointer border-0 bg-transparent p-0 text-left transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-[var(--sb-accent)]"
              onClick={() =>
                onAdd({
                  logicalCardId: card.id,
                  canonicalName: card.canonicalName,
                  category: card.category,
                  imageUrl: card.imageUrl ?? null,
                  printingId: card.representativePrintingId ?? null,
                })
              }
            >
              <CardImage
                src={card.imageUrl}
                alt={card.canonicalName}
                sizes="(max-width: 640px) 30vw, 120px"
                className="group-hover:ring-2 group-hover:ring-[var(--sb-accent)]"
              >
                {inDeck > 0 ? (
                  <Badge
                    size="lg"
                    circle
                    color="ember"
                    className="absolute right-1 top-1 shadow"
                  >
                    {inDeck}
                  </Badge>
                ) : null}
                <span className="absolute inset-x-0 bottom-0 bg-black/60 py-0.5 text-center text-xs font-bold text-white opacity-0 transition-opacity group-hover:opacity-100">
                  + Adicionar
                </span>
              </CardImage>
              <Text size="xs" mt={4} lineClamp={1}>
                {card.canonicalName}
              </Text>
            </button>
          );
        })}
      </div>
    </Stack>
  );
}
