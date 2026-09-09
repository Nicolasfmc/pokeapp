import Link from "next/link";
import Image from "next/image";
import { Badge, Group, Stack, Text, Title } from "@mantine/core";
import type { CardPrintingDto } from "../types";

type CardPrintingDetailProps = {
  printing: CardPrintingDto;
};

export function CardPrintingDetail({ printing }: CardPrintingDetailProps) {
  const set = printing.set;
  const logical = printing.logicalCard;

  return (
    <section className="mx-auto w-full max-w-5xl px-2 py-6 sm:px-4">
      <Stack gap="xl">
        <div>
          <Link
            href="/cards"
            className="text-sm text-[color-mix(in_srgb,var(--poke-ink)_55%,transparent)] no-underline hover:text-[var(--poke-accent)]"
          >
            ← Voltar à busca
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
          <div className="relative aspect-[63/88] overflow-hidden rounded-2xl bg-[color-mix(in_srgb,var(--poke-mist)_45%,transparent)] ring-1 ring-[var(--poke-line)]">
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
              <div className="flex h-full items-center justify-center text-sm text-[color-mix(in_srgb,var(--poke-ink)_55%,transparent)]">
                Sem imagem
              </div>
            )}
          </div>

          <Stack gap="md">
            <Group gap="xs">
              <Badge color="ink" variant="light">
                {printing.category}
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
                  Legalidade
                </Text>
                <Text size="sm">
                  Standard: {printing.legalStandard ? "sim" : "não"} · Expanded:{" "}
                  {printing.legalExpanded ? "sim" : "não"}
                </Text>
              </div>
              <div>
                <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
                  Ilustrador
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
                  className="text-sm font-semibold text-[var(--poke-accent)] no-underline hover:underline"
                >
                  Ver set
                </Link>
              ) : null}
              {logical ? (
                <Link
                  href={`/cards/logical/${logical.id}`}
                  className="text-sm font-semibold text-[var(--poke-accent)] no-underline hover:underline"
                >
                  Carta lógica
                </Link>
              ) : null}
            </Group>
          </Stack>
        </div>
      </Stack>
    </section>
  );
}
