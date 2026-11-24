import Link from "next/link";
import { Text } from "@mantine/core";
import type { CardPrintingDto } from "../types";
import { CardImage } from "./CardImage";

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
      <CardImage
        src={printing.imageUrl}
        alt={printing.name}
        sizes="(max-width: 640px) 45vw, (max-width: 1024px) 20vw, 160px"
      />
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
