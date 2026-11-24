export type CardCategoryDto = "POKEMON" | "TRAINER" | "ENERGY";

export type CardSetDto = {
  id: string;
  tcgdexId: string;
  name: string;
  code: string | null;
  series: string | null;
  releaseDate: string | null;
  logoUrl: string | null;
  symbolUrl: string | null;
  isActive: boolean;
};

export type CardLogicalDto = {
  id: string;
  canonicalName: string;
  category: CardCategoryDto;
  printingCount?: number;
  /** Imagem da impressão padrão (cartas unificadas). */
  imageUrl?: string | null;
  representativePrintingId?: string | null;
};

export type CardPrintingDto = {
  id: string;
  tcgdexId: string;
  logicalCardId: string;
  setId: string;
  localId: string;
  name: string;
  category: CardCategoryDto;
  rarity: string | null;
  illustrator: string | null;
  regulationMark: string | null;
  legalStandard: boolean;
  legalExpanded: boolean;
  imageUrl: string | null;
  isActive: boolean;
  set?: CardSetDto;
  logicalCard?: CardLogicalDto;
};

export type CardSearchMode = "printing" | "logical";

export type CardSearchParams = {
  q?: string;
  name?: string;
  setId?: string;
  setCode?: string;
  setTcgdexId?: string;
  category?: CardCategoryDto;
  rarity?: string;
  regulationMark?: string;
  illustrator?: string;
  localId?: string;
  legalStandard?: boolean;
  legalExpanded?: boolean;
  format?: "standard" | "expanded";
  isActive?: boolean;
  mode?: CardSearchMode;
  page?: number;
  pageSize?: number;
};

export type CardSearchResult = {
  mode: CardSearchMode;
  page: number;
  pageSize: number;
  total: number;
  items: CardPrintingDto[] | CardLogicalDto[];
};

export type CardSetListResult = {
  page: number;
  pageSize: number;
  total: number;
  items: CardSetDto[];
};

export type CardLogicalDetailDto = CardLogicalDto & {
  printings: CardPrintingDto[];
};

export type CardSetDetailDto = CardSetDto & {
  printings: CardPrintingDto[];
  printingCount: number;
};
