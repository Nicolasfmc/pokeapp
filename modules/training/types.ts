export type MatchResultValue = "WIN" | "LOSS" | "DRAW" | "UNKNOWN";
export type TurnOrderValue = "FIRST" | "SECOND";

export type ArchetypeDto = {
  id: string;
  name: string;
  displayPokemon: unknown;
  createdAt: string;
  updatedAt: string;
};

export type StructuredMatchDataDto = {
  parser_version: string;
  raw_log: string;
  source: "TCG_LIVE";
  player1: string | null;
  player2: string | null;
  viewer: string | null;
  winner: string | null;
  result: MatchResultValue;
  turn_order: TurnOrderValue | null;
  going_first_player: string | null;
  format: string | null;
  errors: Array<{ code: string; message: string; lineNumber?: number }>;
};

export type MatchDto = {
  id: string;
  userId: string;
  battleLogId: string | null;
  deckId: string;
  deck: {
    id: string;
    name: string;
    archetype: { id: string; name: string } | null;
  };
  opponentArchetypeId: string | null;
  opponentArchetype: { id: string; name: string } | null;
  result: MatchResultValue;
  turnOrder: TurnOrderValue | null;
  gameFormatCode: string | null;
  formatId: string | null;
  notes: string | null;
  playedAt: string | null;
  createdAt: string;
  updatedAt: string;
  battleLog: {
    id: string;
    source: string;
    parserVersion: string;
    importedAt: string;
  } | null;
  structured: StructuredMatchDataDto | null;
};

export type DeckOption = {
  id: string;
  name: string;
  formatName: string;
};
