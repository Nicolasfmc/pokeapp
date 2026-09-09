export type ExternalCardCategory = "POKEMON" | "TRAINER" | "ENERGY";

export interface ExternalSet {
  tcgdexId: string;
  name: string;
  code: string | null;
  series: string | null;
  seriesId: string | null;
  releaseDate: string | null;
  logoUrl: string | null;
  symbolUrl: string | null;
}

export interface ExternalCard {
  tcgdexId: string;
  localId: string;
  name: string;
  category: ExternalCardCategory;
  setTcgdexId: string;
  rarity: string | null;
  illustrator: string | null;
  regulationMark: string | null;
  legalStandard: boolean;
  legalExpanded: boolean;
  imageUrl: string | null;
  tcgdexUpdatedAt: string | null;
}

export interface CardDataProvider {
  getCard(id: string): Promise<ExternalCard>;
  getSet(id: string): Promise<ExternalSet>;
  listCards(): Promise<ExternalCard[]>;
  listSets(): Promise<ExternalSet[]>;
}

export interface TcgdexSetNormalizeInput {
  id: string;
  name: string;
  logo?: string | null;
  symbol?: string | null;
  releaseDate?: string | null;
  tcgOnline?: string | null;
  abbreviation?: { official?: string | null } | null;
  serie?: { id?: string | null; name?: string | null } | null;
}

export interface TcgdexCardNormalizeInput {
  id: string;
  localId: string;
  name: string;
  category: string;
  rarity?: string | null;
  illustrator?: string | null;
  regulationMark?: string | null;
  image?: string | null;
  updated?: string | null;
  legal?: { standard?: boolean; expanded?: boolean } | null;
  set: { id: string };
}

export interface LogicalCardKey {
  canonicalName: string;
  category: ExternalCardCategory;
}

export interface SyncStats {
  setsUpserted: number;
  setsDeactivated: number;
  cardsUpserted: number;
  cardsDeactivated: number;
  logicalsCreated: number;
}

export interface SyncOptions {
  concurrency?: number;
  language?: string;
}
