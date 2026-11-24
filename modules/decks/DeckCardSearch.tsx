"use client";

import { useEffect, useState } from "react";
import {
  Badge,
  Button,
  Checkbox,
  Group,
  Loader,
  SegmentedControl,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import type { CardCategory } from "@prisma/client";

type LogicalResult = {
  id: string;
  canonicalName: string;
  category: CardCategory;
  printingCount?: number;
};

type Props = {
  formatCode: string;
  onAdd: (card: { logicalCardId: string; canonicalName: string; category: CardCategory }) => void;
};

/** §5.2 — busca de cartas no Deckbuilder (lê só PostgreSQL, nunca a TCGdex). */
export function DeckCardSearch({ formatCode, onAdd }: Props) {
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
        const params = new URLSearchParams({ mode: "logical", q: term, pageSize: "12" });
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
      className="rounded-xl border border-[var(--poke-line)] bg-[var(--poke-panel)]/85 p-4"
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
      <Stack gap={4}>
        {visibleResults.map((card) => (
          <Group key={card.id} justify="space-between" wrap="nowrap" gap="xs">
            <Group gap="xs" wrap="nowrap" className="min-w-0">
              <Text size="sm" truncate>
                {card.canonicalName}
              </Text>
              <Badge size="xs" variant="light">
                {card.category}
              </Badge>
              {card.printingCount ? (
                <Text size="xs" c="dimmed">
                  {card.printingCount} impressões
                </Text>
              ) : null}
            </Group>
            <Button
              size="compact-xs"
              variant="light"
              onClick={() =>
                onAdd({
                  logicalCardId: card.id,
                  canonicalName: card.canonicalName,
                  category: card.category,
                })
              }
            >
              + Adicionar
            </Button>
          </Group>
        ))}
      </Stack>
    </Stack>
  );
}
