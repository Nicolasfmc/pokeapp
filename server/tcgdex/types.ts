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
  /** TCGdex `energyType` ("Normal" = basic energy, "Special"). Null for non-energy cards. */
  energyType?: string | null;
  /** Gameplay identity of the card ("" for Trainers/Energy; see gameplay.ts). */
  gameplayKey?: string;
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
  energyType?: string | null;
  set: { id: string };
  // Gameplay fields (Pokémon) used to tell same-name cards apart.
  hp?: number | null;
  types?: string[] | null;
  stage?: string | null;
  evolveFrom?: string | null;
  abilities?: Array<{ name?: string | null; type?: string | null } | null> | null;
  attacks?: Array<{
    name?: string | null;
    cost?: string[] | null;
    damage?: string | number | null;
  } | null> | null;
  retreat?: number | null;
}

export interface LogicalCardKey {
  canonicalName: string;
  category: ExternalCardCategory;
  /** Gameplay identity ("" for Trainers/Energy; see gameplay.ts). */
  gameplayKey: string;
}

export interface SyncStats {
  setsUpserted: number;
  setsDeactivated: number;
  cardsUpserted: number;
  cardsDeactivated: number;
  logicalsCreated: number;
  /** §11.2 — classificação por carta. */
  cardsNew: number;
  cardsUpdated: number;
  cardsUnchanged: number;
  cardsRemoved: number;
}

export interface SyncOptions {
  concurrency?: number;
  language?: string;
  /** Restringe o sync a estes set ids da TCGdex (sync parcial: não desativa o resto). */
  setIds?: string[];
  /** Séries TCGdex ignoradas (default: `tcgp`, Pokémon TCG Pocket — não é carta física). */
  excludedSeriesIds?: string[];
}
