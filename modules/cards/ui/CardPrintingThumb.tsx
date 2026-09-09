import Link from "next/link";
import Image from "next/image";
import { Text } from "@mantine/core";
import type { CardPrintingDto } from "../types";

type CardPrintingThumbProps = {
  printing: CardPrintingDto;
  href?: string;
};

export function CardPrintingThumb({ printing, href }: CardPrintingThumbProps) {
  const setLabel =
    printing.set?.code || printing.set?.name || printing.set?.tcgdexId || "—";
  const destination = href ?? `/cards/${printing.id}`;

  return (
    <Link
      href={destination}
      className="group flex flex-col gap-2 no-underline text-[var(--poke-ink)] transition-transform hover:-translate-y-0.5"
    >
      <div className="relative aspect-[63/88] overflow-hidden rounded-lg bg-[color-mix(in_srgb,var(--poke-mist)_55%,transparent)] ring-1 ring-[var(--poke-line)]">
        {printing.imageUrl ? (
          <Image
            src={printing.imageUrl}
            alt={printing.name}
            fill
            sizes="(max-width: 640px) 45vw, (max-width: 1024px) 20vw, 160px"
            className="object-cover transition-opacity group-hover:opacity-95"
          />
        ) : (
          <div className="flex h-full items-center justify-center px-3 text-center text-sm text-[color-mix(in_srgb,var(--poke-ink)_55%,transparent)]">
            Sem imagem
          </div>
        )}
      </div>
      <div>
        <Text fw={600} size="sm" lineClamp={2} className="leading-snug">
          {printing.name}
        </Text>
        <Text size="xs" c="dimmed" mt={2}>
          {setLabel} · #{printing.localId}
          {printing.rarity ? ` · ${printing.rarity}` : ""}
        </Text>
      </div>
    </Link>
  );
}
