import Link from "next/link";
import Image from "next/image";
import { SimpleGrid, Stack, Text, Title } from "@mantine/core";
import type { CardSetDetailDto } from "../types";
import { CardPrintingThumb } from "./CardPrintingThumb";
import { getTranslator } from "@/lib/i18n/server";

type CardSetDetailProps = {
  set: CardSetDetailDto;
};

export async function CardSetDetail({ set }: CardSetDetailProps) {
  const { t } = await getTranslator();
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
          <div className="mt-4 flex flex-wrap items-start gap-4">
            {set.logoUrl ? (
              <Image
                src={set.logoUrl}
                alt=""
                width={180}
                height={56}
                className="h-14 w-auto object-contain"
              />
            ) : null}
            <div>
              <Title
                order={1}
                className="font-[family-name:var(--font-space-grotesk)] text-3xl tracking-tight"
              >
                {set.name}
              </Title>
              <Text mt={6} c="dimmed">
                {[set.code, set.series, t("common.cards", { count: set.printings.length })]
                  .filter(Boolean)
                  .join(" · ")}
              </Text>
            </div>
          </div>
        </div>

        <SimpleGrid cols={{ base: 3, sm: 3, md: 4, lg: 6 }} spacing={{ base: "xs", sm: "lg" }}>
          {set.printings.map((printing) => (
            <CardPrintingThumb key={printing.id} printing={printing} />
          ))}
        </SimpleGrid>

        {set.printings.length === 0 ? (
          <Text c="dimmed">{t("cards.noActivePrintings")}</Text>
        ) : null}
      </Stack>
    </section>
  );
}
