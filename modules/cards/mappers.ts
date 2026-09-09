import type { CardCategory, CardLogical, CardPrinting, CardSet } from "@prisma/client";
import type {
  CardCategoryDto,
  CardLogicalDto,
  CardPrintingDto,
  CardSetDto,
} from "./types";

export function toCardCategoryDto(category: CardCategory): CardCategoryDto {
  return category;
}

export function toCardSetDto(set: CardSet): CardSetDto {
  return {
    id: set.id,
    tcgdexId: set.tcgdexId,
    name: set.name,
    code: set.code,
    series: set.series,
    releaseDate: set.releaseDate ? set.releaseDate.toISOString() : null,
    logoUrl: set.logoUrl,
    symbolUrl: set.symbolUrl,
    isActive: set.isActive,
  };
}

export function toCardLogicalDto(
  logical: CardLogical & { _count?: { printings: number } },
): CardLogicalDto {
  return {
    id: logical.id,
    canonicalName: logical.canonicalName,
    category: toCardCategoryDto(logical.category),
    printingCount: logical._count?.printings,
  };
}

type PrintingWithRelations = CardPrinting & {
  set?: CardSet;
  logicalCard?: CardLogical & { _count?: { printings: number } };
};

export function toCardPrintingDto(printing: PrintingWithRelations): CardPrintingDto {
  return {
    id: printing.id,
    tcgdexId: printing.tcgdexId,
    logicalCardId: printing.logicalCardId,
    setId: printing.setId,
    localId: printing.localId,
    name: printing.name,
    category: toCardCategoryDto(printing.category),
    rarity: printing.rarity,
    illustrator: printing.illustrator,
    regulationMark: printing.regulationMark,
    legalStandard: printing.legalStandard,
    legalExpanded: printing.legalExpanded,
    imageUrl: printing.imageUrl,
    isActive: printing.isActive,
    set: printing.set ? toCardSetDto(printing.set) : undefined,
    logicalCard: printing.logicalCard
      ? toCardLogicalDto(printing.logicalCard)
      : undefined,
  };
}
