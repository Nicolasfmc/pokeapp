"use client";

import { FormEvent, startTransition, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Button,
  Group,
  Select,
  SimpleGrid,
  Stack,
  TextInput,
} from "@mantine/core";
import type { CardSearchMode, CardSetDto } from "../types";

const CATEGORY_OPTIONS = [
  { value: "POKEMON", label: "Pokémon" },
  { value: "TRAINER", label: "Trainer" },
  { value: "ENERGY", label: "Energy" },
];

const FORMAT_OPTIONS = [
  { value: "standard", label: "Standard" },
  { value: "expanded", label: "Expanded" },
];

const MODE_OPTIONS = [
  { value: "printing", label: "Impressões" },
  { value: "logical", label: "Cartas lógicas" },
];

function readParam(params: URLSearchParams, key: string) {
  return params.get(key) ?? "";
}

export function CardsSearchFilters({
  initialSets,
}: {
  initialSets: CardSetDto[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [q, setQ] = useState(readParam(searchParams, "q"));
  const [setId, setSetId] = useState(readParam(searchParams, "setId"));
  const [category, setCategory] = useState(readParam(searchParams, "category"));
  const [rarity, setRarity] = useState(readParam(searchParams, "rarity"));
  const [regulationMark, setRegulationMark] = useState(
    readParam(searchParams, "regulationMark"),
  );
  const [format, setFormat] = useState(readParam(searchParams, "format"));
  const [mode, setMode] = useState<CardSearchMode>(
    (readParam(searchParams, "mode") as CardSearchMode) || "printing",
  );

  const setOptions = initialSets.map((set) => ({
    value: set.id,
    label: set.code ? `${set.code} — ${set.name}` : set.name,
  }));

  function applyFilters(nextPage = 1) {
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (setId) params.set("setId", setId);
    if (category) params.set("category", category);
    if (rarity.trim()) params.set("rarity", rarity.trim());
    if (regulationMark.trim()) {
      params.set("regulationMark", regulationMark.trim());
    }
    if (format) params.set("format", format);
    if (mode && mode !== "printing") params.set("mode", mode);
    if (nextPage > 1) params.set("page", String(nextPage));

    const next = params.toString();
    startTransition(() => {
      router.push(next ? `${pathname}?${next}` : pathname);
    });
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    applyFilters(1);
  }

  function clearFilters() {
    setQ("");
    setSetId("");
    setCategory("");
    setRarity("");
    setRegulationMark("");
    setFormat("");
    setMode("printing");
    startTransition(() => {
      router.push(pathname);
    });
  }

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-2xl bg-[color-mix(in_srgb,var(--poke-panel)_88%,transparent)] p-4 ring-1 ring-[var(--poke-line)] sm:p-5"
    >
      <Stack gap="md">
        <TextInput
          label="Buscar"
          placeholder="Nome, local ID ou tcgdex ID"
          value={q}
          onChange={(event) => setQ(event.currentTarget.value)}
        />
        <SimpleGrid cols={{ base: 2, md: 3 }} spacing="sm" verticalSpacing="sm">
          <Select
            label="Set"
            placeholder="Todos os sets"
            data={setOptions}
            value={setId || null}
            searchable
            clearable
            onChange={(value) => setSetId(value ?? "")}
          />
          <Select
            label="Categoria"
            placeholder="Todas"
            data={CATEGORY_OPTIONS}
            value={category || null}
            clearable
            onChange={(value) => setCategory(value ?? "")}
          />
          <Select
            label="Formato / legalidade"
            placeholder="Qualquer"
            data={FORMAT_OPTIONS}
            value={format || null}
            clearable
            onChange={(value) => setFormat(value ?? "")}
          />
          <TextInput
            label="Raridade"
            placeholder="ex.: Rare, Common"
            value={rarity}
            onChange={(event) => setRarity(event.currentTarget.value)}
          />
          <TextInput
            label="Regulation mark"
            placeholder="ex.: G, H"
            value={regulationMark}
            onChange={(event) => setRegulationMark(event.currentTarget.value)}
          />
          <Select
            label="Modo"
            data={MODE_OPTIONS}
            value={mode}
            onChange={(value) =>
              setMode((value as CardSearchMode) || "printing")
            }
          />
        </SimpleGrid>
        <Group justify="flex-end" gap="sm">
          <Button type="button" variant="subtle" color="ink" onClick={clearFilters}>
            Limpar
          </Button>
          <Button type="submit" color="ember">
            Buscar
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
