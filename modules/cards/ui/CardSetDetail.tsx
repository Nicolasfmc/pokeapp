import Link from "next/link";
import Image from "next/image";
import { SimpleGrid, Stack, Text, Title } from "@mantine/core";
import type { CardSetDetailDto } from "../types";
import { CardPrintingThumb } from "./CardPrintingThumb";

type CardSetDetailProps = {
  set: CardSetDetailDto;
};

export function CardSetDetail({ set }: CardSetDetailProps) {
  return (
    <section className="mx-auto w-full max-w-6xl px-2 py-6 sm:px-4">
      <Stack gap="lg">
        <div>
          <Link
            href="/cards"
            className="text-sm text-[color-mix(in_srgb,var(--sb-ink)_55%,transparent)] no-underline hover:text-[var(--sb-accent)]"
          >
            ← Voltar à busca
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
                {[set.code, set.series, `${set.printings.length} cartas`]
                  .filter(Boolean)
                  .join(" · ")}
              </Text>
            </div>
          </div>
        </div>

        <SimpleGrid cols={{ base: 2, sm: 3, md: 4, lg: 6 }} spacing="lg">
          {set.printings.map((printing) => (
            <CardPrintingThumb key={printing.id} printing={printing} />
          ))}
        </SimpleGrid>

        {set.printings.length === 0 ? (
          <Text c="dimmed">Nenhuma impressão ativa neste set.</Text>
        ) : null}
      </Stack>
    </section>
  );
}
