import type {
  CardCategory,
  DeckImportStatus,
  DeckTagName,
  PhysicalStatus,
} from "@prisma/client";

export type DeckCardDto = {
  id: string;
  logicalCardId: string;
  quantity: number;
  canonicalName: string;
  category: CardCategory;
  /** Impressão padrão usada como imagem (carta unificada). */
  printingId: string | null;
  imageUrl: string | null;
};

export type DeckDto = {
  id: string;
  name: string;
  description: string | null;
  formatId: string;
  format: { id: string; code: string; name: string };
  archetypeId: string | null;
  archetype: { id: string; name: string } | null;
  physicalStatus: PhysicalStatus;
  importStatus: DeckImportStatus | null;
  tags: DeckTagName[];
  cards: DeckCardDto[];
  cardCount: number;
  coverPrintingId: string | null;
  /** Capa escolhida ou, sem escolha, o Pokémon com mais cópias. */
  coverImageUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

export type UnresolvedImportLine = {
  quantity: number;
  name: string;
  setCode: string;
  collectorNumber: string;
  reason: string;
};
