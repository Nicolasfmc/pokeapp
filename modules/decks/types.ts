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
