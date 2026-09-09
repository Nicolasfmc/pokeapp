import Link from "next/link";
import { SimpleGrid, Stack, Text, Title } from "@mantine/core";
import type {
  CardLogicalDto,
  CardPrintingDto,
  CardSearchResult,
  CardSetDto,
} from "../types";
import { CardPrintingThumb } from "./CardPrintingThumb";
import { CardsPagination } from "./CardsPagination";
import { CardsSearchFilters } from "./CardsSearchFilters";

type CardsSearchViewProps = {
  initialSets: CardSetDto[];
  result: CardSearchResult;
};

export function CardsSearchView({ initialSets, result }: CardsSearchViewProps) {
  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));

  return (
    <section className="mx-auto w-full max-w-6xl px-2 py-6 sm:px-4">
      <Stack gap="lg">
        <div>
          <Title
            order={1}
            className="font-[family-name:var(--font-space-grotesk)] text-3xl tracking-tight"
          >
            Cards
          </Title>
          <Text className="mt-2 max-w-2xl text-[color-mix(in_srgb,var(--poke-ink)_75%,transparent)]">
            Busca local no catálogo sincronizado — filtros por nome, set,
            categoria, legalidade e regulation mark.
          </Text>
        </div>

        <CardsSearchFilters initialSets={initialSets} />

        <Text size="sm" c="dimmed">
          {result.total} resultado{result.total === 1 ? "" : "s"}
        </Text>

        {result.mode === "logical" ? (
          <Stack gap="xs">
            {(result.items as CardLogicalDto[]).map((logical) => (
              <Link
                key={logical.id}
                href={`/cards/logical/${logical.id}`}
                className="flex items-center justify-between gap-3 rounded-xl px-3 py-3 no-underline text-[var(--poke-ink)] ring-1 ring-[var(--poke-line)] transition-colors hover:bg-[color-mix(in_srgb,var(--poke-accent-soft)_55%,transparent)]"
              >
                <div>
                  <Text fw={600}>{logical.canonicalName}</Text>
                  <Text size="sm" c="dimmed">
                    {logical.category}
                    {logical.printingCount !== undefined
                      ? ` · ${logical.printingCount} impressão(ões)`
                      : ""}
                  </Text>
                </div>
                <Text size="sm" c="dimmed">
                  Ver
                </Text>
              </Link>
            ))}
          </Stack>
        ) : (
          <SimpleGrid cols={{ base: 2, sm: 3, md: 4, lg: 6 }} spacing="lg">
            {(result.items as CardPrintingDto[]).map((printing) => (
              <CardPrintingThumb key={printing.id} printing={printing} />
            ))}
          </SimpleGrid>
        )}

        {result.total === 0 ? (
          <Text c="dimmed">Nenhuma carta encontrada com esses filtros.</Text>
        ) : null}

        <CardsPagination page={result.page} totalPages={totalPages} />

        <div>
          <Title order={3} size="h4" mb="sm">
            Sets recentes
          </Title>
          <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="sm">
            {initialSets.slice(0, 9).map((set) => (
              <Link
                key={set.id}
                href={`/cards/sets/${set.id}`}
                className="rounded-xl px-3 py-3 no-underline text-[var(--poke-ink)] ring-1 ring-[var(--poke-line)] transition-colors hover:bg-[color-mix(in_srgb,var(--poke-panel)_90%,var(--poke-accent-soft))]"
              >
                <Text fw={600} size="sm">
                  {set.name}
                </Text>
                <Text size="xs" c="dimmed">
                  {[set.code, set.series].filter(Boolean).join(" · ") ||
                    set.tcgdexId}
                </Text>
              </Link>
            ))}
          </SimpleGrid>
        </div>
      </Stack>
    </section>
  );
}
