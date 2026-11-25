"use client";

import { useEffect, useState } from "react";
import { Group, Loader, Select, Text } from "@mantine/core";
import { CardThumb } from "@/modules/cards/ui/CardImage";
import { useI18n } from "@/lib/i18n/I18nProvider";

type PrintingResult = {
  id: string;
  name: string;
  localId: string;
  tcgdexId: string;
  rarity: string | null;
  imageUrl: string | null;
  set?: { code: string | null; name: string };
};

type Props = {
  value: string | null;
  onChange: (printingId: string | null, label: string | null) => void;
};

function labelFor(p: PrintingResult) {
  const set = p.set?.code ?? p.set?.name ?? "";
  return `${p.name} — ${set} ${p.localId}${p.rarity ? ` · ${p.rarity}` : ""}`;
}

/**
 * Busca de impressão física (§17: Inventory trabalha com CardPrinting).
 * Aceita nome ("Buddy-Buddy Poffin"), "TEF 144" ou tcgdex id ("sv05-144").
 */
export function PrintingPicker({ value, onChange }: Props) {
  const { t } = useI18n();
  const [search, setSearch] = useState("");
  const [options, setOptions] = useState<
    Array<{ value: string; label: string; imageUrl: string | null }>
  >([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const term = search.trim();
    if (term.length < 2) return;
    const selected = options.find((o) => o.value === value);
    if (selected && selected.label === search) return;

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ mode: "printing", pageSize: "20" });
        // "TEF 144" → set + número
        const setAndNumber = term.match(/^([A-Za-z0-9.-]{2,8})\s+([A-Za-z0-9]+)$/);
        if (setAndNumber && /\d/.test(setAndNumber[2])) {
          params.set("setCode", setAndNumber[1]);
          params.set("localId", setAndNumber[2]);
        } else {
          params.set("q", term);
        }
        let response = await fetch(`/api/cards/search?${params}`, {
          signal: controller.signal,
        });
        let data = (await response.json()) as { items?: PrintingResult[] };
        if (setAndNumber && response.ok && (data.items?.length ?? 0) === 0) {
          // Não era set+número: tenta como nome.
          const byName = new URLSearchParams({ mode: "printing", pageSize: "20", q: term });
          response = await fetch(`/api/cards/search?${byName}`, { signal: controller.signal });
          data = (await response.json()) as { items?: PrintingResult[] };
        }
        if (response.ok) {
          setOptions(
            (data.items ?? []).map((p) => ({
              value: p.id,
              label: labelFor(p),
              imageUrl: p.imageUrl,
            })),
          );
        }
      } catch {
        /* abort / rede: mantém opções atuais */
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
    // `options`/`value` só servem para não refazer a busca ao selecionar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const selectedImage = options.find((o) => o.value === value)?.imageUrl ?? null;

  return (
    <Select
      label={t("picker.label")}
      placeholder={t("picker.placeholder")}
      searchable
      clearable
      required
      data={options}
      value={value}
      searchValue={search}
      onSearchChange={setSearch}
      onChange={(next) => {
        const option = options.find((o) => o.value === next);
        onChange(next, option?.label ?? null);
      }}
      filter={({ options: all }) => all}
      maxDropdownHeight={360}
      leftSection={
        selectedImage ? <CardThumb src={selectedImage} alt="" width={20} /> : undefined
      }
      renderOption={({ option }) => {
        const image = options.find((o) => o.value === option.value)?.imageUrl;
        return (
          <Group gap="sm" wrap="nowrap">
            <CardThumb src={image} alt={option.label} width={44} />
            <Text size="sm">{option.label}</Text>
          </Group>
        );
      }}
      nothingFoundMessage={search.trim().length >= 2 && !loading ? t("picker.nothingFound") : undefined}
      rightSection={loading ? <Loader size="xs" /> : undefined}
      className="min-w-[260px] flex-[2]"
    />
  );
}
