export {
  TournamentServiceError,
  listTournaments,
  getTournament,
  createTournament,
  updateTournament,
  deleteTournament,
  listAttachableMatches,
  attachMatch,
  updateTournamentMatch,
  detachMatch,
} from "@/server/services/tournament";
export type {
  CreateTournamentInput,
  UpdateTournamentInput,
  TournamentListItemDto,
  TournamentDetailDto,
  TournamentMatchSummaryDto,
  AttachableMatchDto,
} from "@/server/services/tournament";
