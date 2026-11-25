import Link from "next/link";
import Image from "next/image";
import { Badge, Group, Stack, Text, Title } from "@mantine/core";
import type { CardPrintingDto } from "../types";
import { getTranslator } from "@/lib/i18n/server";

type CardPrintingDetailProps = {
  printing: CardPrintingDto;
};

export async function CardPrintingDetail({ printing }: CardPrintingDetailProps) {
  const { t, tEnum } = await getTranslator();
  const set = printing.set;
  const logical = printing.logicalCard;

  return (
    <section className="mx-auto w-full max-w-5xl px-2 py-6 sm:px-4">
      <Stack gap="xl">
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
            {printing.name}
          </Title>
          <Text mt={6} c="dimmed">
            {set ? `${set.name}` : "Set"} · #{printing.localId}
            {set?.code ? ` (${set.code})` : ""}
          </Text>
        </div>

        <div className="grid gap-8 md:grid-cols-[minmax(0,280px)_1fr]">
          <div className="relative aspect-[63/88] overflow-hidden rounded-2xl bg-[color-mix(in_srgb,var(--sb-mist)_45%,transparent)] ring-1 ring-[var(--sb-line)]">
            {printing.imageUrl ? (
              <Image
                src={printing.imageUrl}
                alt={printing.name}
                fill
                sizes="(max-width: 768px) 90vw, 280px"
                className="object-cover"
                priority
              />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-[color-mix(in_srgb,var(--sb-ink)_55%,transparent)]">
                {t("cards.noImage")}
              </div>
            )}
          </div>

          <Stack gap="md">
            <Group gap="xs">
              <Badge color="ink" variant="light">
                {tEnum("category", printing.category)}
              </Badge>
              {printing.rarity ? (
                <Badge color="ember" variant="light">
                  {printing.rarity}
                </Badge>
              ) : null}
              {printing.regulationMark ? (
                <Badge variant="outline" color="ink">
                  Reg {printing.regulationMark}
                </Badge>
              ) : null}
            </Group>

            <dl className="m-0 grid gap-3 sm:grid-cols-2">
              <div>
                <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
                  {t("cards.legality")}
                </Text>
                <Text size="sm">
                  {tEnum("format", "standard")}: {printing.legalStandard ? t("common.yes") : t("common.no")} ·{" "}
                  {tEnum("format", "expanded")}: {printing.legalExpanded ? t("common.yes") : t("common.no")}
                </Text>
              </div>
              <div>
                <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
                  {t("cards.illustrator")}
                </Text>
                <Text size="sm">{printing.illustrator ?? "—"}</Text>
              </div>
              <div>
                <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
                  TCGdex ID
                </Text>
                <Text size="sm" className="font-mono">
                  {printing.tcgdexId}
                </Text>
              </div>
              <div>
                <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
                  Local ID
                </Text>
                <Text size="sm" className="font-mono">
                  {printing.localId}
                </Text>
              </div>
            </dl>

            <Group gap="md" mt="sm">
              {set ? (
                <Link
                  href={`/cards/sets/${set.id}`}
                  className="text-sm font-semibold text-[var(--sb-accent)] no-underline hover:underline"
                >
                  {t("cards.seeSet")}
                </Link>
              ) : null}
              {logical ? (
                <Link
                  href={`/cards/logical/${logical.id}`}
                  className="text-sm font-semibold text-[var(--sb-accent)] no-underline hover:underline"
                >
                  {t("cards.logicalCard")}
                </Link>
              ) : null}
            </Group>
          </Stack>
        </div>
      </Stack>
    </section>
  );
}
