import Link from "next/link";
import { Badge, SimpleGrid, Stack, Text, Title } from "@mantine/core";
import type { CardLogicalDetailDto } from "../types";
import { CardPrintingThumb } from "./CardPrintingThumb";
import { getTranslator } from "@/lib/i18n/server";

type CardLogicalDetailProps = {
  logical: CardLogicalDetailDto;
};

export async function CardLogicalDetail({ logical }: CardLogicalDetailProps) {
  const { t, tEnum } = await getTranslator();
  return (
    <section className="mx-auto w-full max-w-6xl px-2 py-6 sm:px-4">
      <Stack gap="lg">
        <div>
          <Link
            href="/cards"
            className="text-sm text-[color-mix(in_srgb,var(--sb-ink)_55%,transparent)] no-underline hover:text-[var(--sb-accent)]"
          >
            {t("cards.backToSearch")}
          </Link>
          <Title
            order={1}
            mt="sm"
            className="font-[family-name:var(--font-space-grotesk)] text-3xl tracking-tight"
          >
            {logical.canonicalName}
          </Title>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge color="ink" variant="light">
              {tEnum("category", logical.category)}
            </Badge>
            <Text size="sm" c="dimmed">
              {t("cards.printingCount", { count: logical.printings.length })}
            </Text>
          </div>
          <Text mt="sm" className="max-w-2xl text-[color-mix(in_srgb,var(--sb-ink)_75%,transparent)]">
            {t("cards.logicalSubtitle")}
          </Text>
        </div>

        <SimpleGrid cols={{ base: 3, sm: 3, md: 4, lg: 6 }} spacing={{ base: "xs", sm: "lg" }}>
          {logical.printings.map((printing) => (
            <CardPrintingThumb key={printing.id} printing={printing} />
          ))}
        </SimpleGrid>
      </Stack>
    </section>
  );
}
