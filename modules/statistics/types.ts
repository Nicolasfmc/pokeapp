export type RecordStats = {
  matches: number;
  wins: number;
  losses: number;
  draws: number;
  unknowns: number;
  winRate: number | null;
};

export type StatisticsFilters = {
  deckId?: string;
  opponentArchetypeId?: string;
  gameFormatCode?: string;
  tournamentId?: string;
  from?: string;
  to?: string;
};

export type DeckStatsRow = RecordStats & {
  deckId: string;
  deckName: string;
};

export type MatchupStatsRow = RecordStats & {
  opponentArchetypeId: string | null;
  opponentArchetypeName: string | null;
};

export type TurnOrderStatsRow = RecordStats & {
  turnOrder: "FIRST" | "SECOND" | "UNKNOWN";
};

export type StatisticsSummary = {
  overall: RecordStats;
  byDeck: DeckStatsRow[];
  byMatchup: MatchupStatsRow[];
  byTurnOrder: TurnOrderStatsRow[];
  filters: StatisticsFilters;
};

export type StatisticsFilterOptions = {
  decks: Array<{ id: string; name: string }>;
  archetypes: Array<{ id: string; name: string }>;
  gameFormatCodes: string[];
  tournaments: Array<{ id: string; name: string }>;
};
