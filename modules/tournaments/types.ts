export type MatchResultValue = "WIN" | "LOSS" | "DRAW" | "UNKNOWN";
export type TurnOrderValue = "FIRST" | "SECOND";

export type TournamentListItemDto = {
  id: string;
  userId: string;
  name: string;
  date: string | null;
  location: string | null;
  formatId: string | null;
  format: { id: string; name: string; code: string } | null;
  placement: number | null;
  participantCount: number | null;
  matchCount: number;
  createdAt: string;
  updatedAt: string;
};

export type TournamentMatchSummaryDto = {
  id: string;
  tournamentId: string;
  matchId: string;
  round: number | null;
  match: {
    id: string;
    result: MatchResultValue;
    turnOrder: TurnOrderValue | null;
    playedAt: string | null;
    notes: string | null;
    deck: { id: string; name: string };
    opponentArchetype: { id: string; name: string } | null;
  };
};

export type TournamentDetailDto = {
  id: string;
  userId: string;
  name: string;
  date: string | null;
  location: string | null;
  formatId: string | null;
  format: { id: string; name: string; code: string } | null;
  placement: number | null;
  participantCount: number | null;
  createdAt: string;
  updatedAt: string;
  tournamentMatches: TournamentMatchSummaryDto[];
};

export type AttachableMatchDto = {
  id: string;
  result: MatchResultValue;
  turnOrder: TurnOrderValue | null;
  playedAt: string | null;
  notes: string | null;
  deck: { id: string; name: string };
  opponentArchetype: { id: string; name: string } | null;
};

export type FormatOption = {
  id: string;
  name: string;
  code: string;
};
