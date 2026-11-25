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
import { useI18n } from "@/lib/i18n/I18nProvider";

const CATEGORIES = ["POKEMON", "TRAINER", "ENERGY"];
const FORMATS = ["standard", "expanded", "all"];

function readParam(params: URLSearchParams, key: string) {
  return params.get(key) ?? "";
}

export function CardsSearchFilters({
  initialSets,
}: {
  initialSets: CardSetDto[];
}) {
  const router = useRouter();
  const { t, tEnum } = useI18n();
  const CATEGORY_OPTIONS = CATEGORIES.map((value) => ({ value, label: tEnum("category", value) }));
  const FORMAT_OPTIONS = FORMATS.map((value) => ({ value, label: tEnum("format", value) }));
  const MODE_OPTIONS = [
    { value: "logical", label: t("cards.modeLogical") },
    { value: "printing", label: t("cards.modePrinting") },
  ];
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [q, setQ] = useState(readParam(searchParams, "q"));
  const [setId, setSetId] = useState(readParam(searchParams, "setId"));
  const [category, setCategory] = useState(readParam(searchParams, "category"));
  const [rarity, setRarity] = useState(readParam(searchParams, "rarity"));
  const [regulationMark, setRegulationMark] = useState(
    readParam(searchParams, "regulationMark"),
  );
  const [format, setFormat] = useState(
    readParam(searchParams, "format") || "standard",
  );
  const [mode, setMode] = useState<CardSearchMode>(
    (readParam(searchParams, "mode") as CardSearchMode) || "logical",
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
    if (format && format !== "standard") params.set("format", format);
    if (mode && mode !== "logical") params.set("mode", mode);
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
    setFormat("standard");
    setMode("logical");
    startTransition(() => {
      router.push(pathname);
    });
  }

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-2xl bg-[color-mix(in_srgb,var(--sb-panel)_88%,transparent)] p-4 ring-1 ring-[var(--sb-line)] sm:p-5"
    >
      <Stack gap="md">
        <TextInput
          label={t("cards.searchLabel")}
          placeholder={t("cards.searchPlaceholder")}
          value={q}
          onChange={(event) => setQ(event.currentTarget.value)}
        />
        <SimpleGrid cols={{ base: 2, md: 3 }} spacing="sm" verticalSpacing="sm">
          <Select
            label={t("cards.set")}
            placeholder={t("cards.allSets")}
            data={setOptions}
            value={setId || null}
            searchable
            clearable
            onChange={(value) => setSetId(value ?? "")}
          />
          <Select
            label={t("cards.category")}
            placeholder={t("cards.allCategories")}
            data={CATEGORY_OPTIONS}
            value={category || null}
            clearable
            onChange={(value) => setCategory(value ?? "")}
          />
          <Select
            label={t("cards.formatLegality")}
            placeholder={t("common.any")}
            data={FORMAT_OPTIONS}
            value={format}
            allowDeselect={false}
            onChange={(value) => setFormat(value ?? "standard")}
          />
          <TextInput
            label={t("cards.rarity")}
            placeholder={t("cards.rarityPlaceholder")}
            value={rarity}
            onChange={(event) => setRarity(event.currentTarget.value)}
          />
          <TextInput
            label={t("cards.regulationMark")}
            placeholder={t("cards.regulationPlaceholder")}
            value={regulationMark}
            onChange={(event) => setRegulationMark(event.currentTarget.value)}
          />
          <Select
            label={t("cards.display")}
            data={MODE_OPTIONS}
            value={mode}
            allowDeselect={false}
            onChange={(value) =>
              setMode((value as CardSearchMode) || "logical")
            }
          />
        </SimpleGrid>
        <Group justify="flex-end" gap="sm">
          <Button type="button" variant="subtle" color="ink" onClick={clearFilters}>
            {t("cards.clear")}
          </Button>
          <Button type="submit" color="ember">
            {t("common.search")}
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
