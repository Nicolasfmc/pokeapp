export type HostedStatus = "REGISTRATION" | "IN_PROGRESS" | "FINISHED";
export type HostedLocationTypeValue = "IN_PERSON" | "ONLINE";
export type HostedDeckPolicyValue = "REQUIRED" | "OPTIONAL";
export type HostedEntryStatusValue = "ACTIVE" | "DROPPED";
export type HostedPairingStatusValue =
  | "PENDING"
  | "AWAITING_CONFIRMATION"
  | "CONFIRMED"
  | "DISPUTED"
  | "BYE";
export type HostedPairingResultValue = "PLAYER1_WIN" | "PLAYER2_WIN" | "DRAW";
export type HostedResultSourceValue = "PLAYERS" | "TIMER" | "JUDGE" | "BYE";

export type HostedRecord = { wins: number; losses: number; draws: number };

export type HostedPlayerRef = {
  entryId: string;
  username: string;
  displayName: string;
  /** The organizer is also the judge: shown with a badge to everyone. */
  isJudge: boolean;
  dropped: boolean;
};

export type HostedTimerDto = {
  durationSeconds: number;
  /** Seconds left (frozen while paused; 0 once expired). */
  remainingSeconds: number;
  /** ISO end time while running; null when paused. */
  endsAt: string | null;
  paused: boolean;
  expired: boolean;
};

export type HostedPairingDto = {
  id: string;
  tableNumber: number | null;
  player1: HostedPlayerRef & { record: HostedRecord };
  player2: (HostedPlayerRef & { record: HostedRecord }) | null;
  status: HostedPairingStatusValue;
  result: HostedPairingResultValue | null;
  player1Games: number;
  player2Games: number;
  drawGames: number;
  source: HostedResultSourceValue | null;
  reportedByEntryId: string | null;
  /** Viewer may report (or re-report) this pairing. */
  canReport: boolean;
  /** Viewer is the opponent of the reporter and may confirm/dispute. */
  canConfirm: boolean;
  /** Viewer is the organizer/judge. */
  canJudge: boolean;
};

export type HostedRoundDto = {
  number: number;
  status: "IN_PROGRESS" | "FINISHED";
  timer: HostedTimerDto;
  pairings: HostedPairingDto[];
};

export type HostedStandingDto = HostedPlayerRef & {
  rank: number;
  points: number;
  wins: number;
  losses: number;
  draws: number;
  omw: number;
  oomw: number;
};

export type HostedTournamentInfo = {
  code: string;
  name: string;
  date: string | null;
  locationType: HostedLocationTypeValue;
  location: string | null;
  format: { id: string; name: string; code: string };
  bestOf: number;
  pointsWin: number;
  pointsDraw: number;
  pointsLoss: number;
  deckPolicy: HostedDeckPolicyValue;
  plannedRounds: number | null;
  suggestedRounds: number;
  roundMinutes: number;
  maxPlayers: number | null;
  status: HostedStatus;
  currentRound: number;
  startedAt: string | null;
  finishedAt: string | null;
  organizer: { username: string; displayName: string };
  playerCount: number;
};

export type HostedViewerDto = {
  signedIn: boolean;
  isOrganizer: boolean;
  entryId: string | null;
  entryStatus: HostedEntryStatusValue | null;
  /** The viewer's own registered deck (only while registration is open). */
  deck: { id: string; name: string } | null;
  /** The viewer's decks of the tournament format (only while registration is open). */
  eligibleDecks: Array<{ id: string; name: string; cardCount: number }>;
  canJoin: boolean;
};

export type HostedTournamentViewDto = {
  serverNow: string;
  tournament: HostedTournamentInfo;
  viewer: HostedViewerDto;
  players: Array<HostedPlayerRef & { hasDeck: boolean }>;
  rounds: HostedRoundDto[];
  standings: HostedStandingDto[];
};

export type HostedTournamentSummaryDto = {
  code: string;
  name: string;
  date: string | null;
  locationType: HostedLocationTypeValue;
  location: string | null;
  format: { id: string; name: string; code: string };
  status: HostedStatus;
  currentRound: number;
  plannedRounds: number | null;
  playerCount: number;
  role: "ORGANIZER" | "PLAYER" | "BOTH";
  organizer: { username: string; displayName: string };
};

export type HostedTournamentSettingsInput = {
  name?: unknown;
  date?: unknown;
  locationType?: unknown;
  location?: unknown;
  formatId?: unknown;
  bestOf?: unknown;
  pointsWin?: unknown;
  pointsDraw?: unknown;
  pointsLoss?: unknown;
  deckPolicy?: unknown;
  plannedRounds?: unknown;
  roundMinutes?: unknown;
  maxPlayers?: unknown;
};
