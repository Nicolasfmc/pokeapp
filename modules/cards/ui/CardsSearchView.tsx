import Link from "next/link";
import { SimpleGrid, Stack, Text, Title } from "@mantine/core";
import type {
  CardLogicalDto,
  CardPrintingDto,
  CardSearchResult,
  CardSetDto,
} from "../types";
import { CardImage } from "./CardImage";
import { CardPrintingThumb } from "./CardPrintingThumb";
import { CardsPagination } from "./CardsPagination";
import { CardsSearchFilters } from "./CardsSearchFilters";
import { getTranslator } from "@/lib/i18n/server";

type CardsSearchViewProps = {
  initialSets: CardSetDto[];
  result: CardSearchResult;
};

export async function CardsSearchView({ initialSets, result }: CardsSearchViewProps) {
  const { t, tEnum } = await getTranslator();
  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));

  return (
    <section className="mx-auto w-full max-w-6xl px-2 py-6 sm:px-4">
      <Stack gap="lg">
        <div>
          <Title
            order={1}
            className="font-[family-name:var(--font-space-grotesk)] text-3xl tracking-tight"
          >
            {t("nav.cards")}
          </Title>
          <Text className="mt-2 max-w-2xl text-[color-mix(in_srgb,var(--sb-ink)_75%,transparent)]">
            {t("cards.subtitle")}
          </Text>
        </div>

        <CardsSearchFilters initialSets={initialSets} />

        <Text size="sm" c="dimmed">
          {result.total === 1 ? t("cards.result") : t("cards.results", { count: result.total })}
        </Text>

        {result.mode === "logical" ? (
          <SimpleGrid cols={{ base: 3, sm: 3, md: 4, lg: 6 }} spacing={{ base: "xs", sm: "lg" }}>
            {(result.items as CardLogicalDto[]).map((logical) => (
              <Link
                key={logical.id}
                href={`/cards/logical/${logical.id}`}
                className="group flex flex-col gap-2 no-underline text-[var(--sb-ink)] transition-transform hover:-translate-y-0.5"
                title={t("cards.seeAllPrintings")}
              >
                <CardImage
                  src={logical.imageUrl}
                  alt={logical.canonicalName}
                  sizes="(max-width: 640px) 45vw, (max-width: 1024px) 20vw, 160px"
                />
                <div>
                  <Text fw={600} size="sm" lineClamp={2} className="leading-snug">
                    {logical.canonicalName}
                  </Text>
                  <Text size="xs" c="dimmed" mt={2}>
                    {logical.printingCount !== undefined
                      ? t("cards.printingCountPick", { count: logical.printingCount })
                      : tEnum("category", logical.category)}
                  </Text>
                </div>
              </Link>
            ))}
          </SimpleGrid>
        ) : (
          <SimpleGrid cols={{ base: 3, sm: 3, md: 4, lg: 6 }} spacing={{ base: "xs", sm: "lg" }}>
            {(result.items as CardPrintingDto[]).map((printing) => (
              <CardPrintingThumb key={printing.id} printing={printing} />
            ))}
          </SimpleGrid>
        )}

        {result.total === 0 ? (
          <Text c="dimmed">{t("cards.noResults")}</Text>
        ) : null}

        <CardsPagination page={result.page} totalPages={totalPages} />

        <div>
          <Title order={3} size="h4" mb="sm">
            {t("cards.recentSets")}
          </Title>
          <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="sm">
            {initialSets.slice(0, 9).map((set) => (
              <Link
                key={set.id}
                href={`/cards/sets/${set.id}`}
                className="rounded-xl px-3 py-3 no-underline text-[var(--sb-ink)] ring-1 ring-[var(--sb-line)] transition-colors hover:bg-[color-mix(in_srgb,var(--sb-panel)_90%,var(--sb-accent-soft))]"
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
