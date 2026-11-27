/**
 * Swiss-system engine: standings with tiebreakers and pairings.
 * Pure functions (no database), so they can be unit tested.
 *
 * Rules (agreed with the organizer flow):
 * - Round 1: random pairings; the bye goes to a random player.
 * - Next rounds: players are paired inside their score group, never against
 *   someone they already played; an odd group floats one player down.
 *   The bye goes to the lowest-ranked active player without a bye yet.
 * - Standings: points → opponents' win % (OMW) → opponents' opponents' win %
 *   (OOMW) → head-to-head → name.
 */

export type MatchOutcome = "PLAYER1_WIN" | "PLAYER2_WIN" | "DRAW";

export type ScoringRules = { win: number; draw: number; loss: number };

export type SwissPlayer = {
  id: string;
  name: string;
  /** Dropped players keep their results but are no longer paired. */
  active: boolean;
};

/** A finished match. `player2Id` null = bye (counts as a win for player 1). */
export type SwissResult = {
  player1Id: string;
  player2Id: string | null;
  outcome: MatchOutcome;
};

export type StandingRow = {
  playerId: string;
  rank: number;
  points: number;
  wins: number;
  losses: number;
  draws: number;
  byes: number;
  /** Matches played against a real opponent (byes excluded). */
  matchesPlayed: number;
  winRate: number;
  omw: number;
  oomw: number;
};

/** Minimum win rate used in tiebreakers, so early losses don't zero others out. */
export const MIN_WIN_RATE = 0.25;

export function suggestedRounds(playerCount: number): number {
  if (playerCount <= 2) return 1;
  return Math.ceil(Math.log2(playerCount));
}

export function pairKey(a: string, b: string) {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

type Tally = {
  points: number;
  wins: number;
  losses: number;
  draws: number;
  byes: number;
  realPoints: number;
  opponents: string[];
};

const EPSILON = 1e-9;

export function computeStandings(
  players: SwissPlayer[],
  results: SwissResult[],
  rules: ScoringRules,
): StandingRow[] {
  const tally = new Map<string, Tally>();
  for (const player of players) {
    tally.set(player.id, {
      points: 0,
      wins: 0,
      losses: 0,
      draws: 0,
      byes: 0,
      realPoints: 0,
      opponents: [],
    });
  }

  // Decisive head-to-head results: "winner|loser".
  const beat = new Set<string>();

  for (const result of results) {
    const p1 = tally.get(result.player1Id);
    if (!p1) continue;
    if (result.player2Id === null) {
      p1.byes += 1;
      p1.wins += 1;
      p1.points += rules.win;
      continue;
    }
    const p2 = tally.get(result.player2Id);
    if (!p2) continue;
    p1.opponents.push(result.player2Id);
    p2.opponents.push(result.player1Id);
    if (result.outcome === "DRAW") {
      for (const p of [p1, p2]) {
        p.draws += 1;
        p.points += rules.draw;
        p.realPoints += rules.draw;
      }
    } else {
      const [winner, loser, winnerId, loserId] =
        result.outcome === "PLAYER1_WIN"
          ? [p1, p2, result.player1Id, result.player2Id]
          : [p2, p1, result.player2Id, result.player1Id];
      winner.wins += 1;
      winner.points += rules.win;
      winner.realPoints += rules.win;
      loser.losses += 1;
      loser.points += rules.loss;
      loser.realPoints += rules.loss;
      beat.add(`${winnerId}|${loserId}`);
    }
  }

  const winRate = new Map<string, number>();
  for (const [id, t] of tally) {
    const played = t.opponents.length;
    const raw = played === 0 || rules.win <= 0 ? 0 : t.realPoints / (rules.win * played);
    winRate.set(id, Math.min(1, Math.max(MIN_WIN_RATE, raw)));
  }

  const average = (ids: string[], values: Map<string, number>) =>
    ids.length === 0 ? 0 : ids.reduce((sum, id) => sum + (values.get(id) ?? 0), 0) / ids.length;

  const omw = new Map<string, number>();
  for (const [id, t] of tally) omw.set(id, average(t.opponents, winRate));
  const oomw = new Map<string, number>();
  for (const [id, t] of tally) oomw.set(id, average(t.opponents, omw));

  const names = new Map(players.map((p) => [p.id, p.name]));

  const rows = players.map((player) => {
    const t = tally.get(player.id)!;
    return {
      playerId: player.id,
      rank: 0,
      points: t.points,
      wins: t.wins,
      losses: t.losses,
      draws: t.draws,
      byes: t.byes,
      matchesPlayed: t.opponents.length,
      winRate: winRate.get(player.id) ?? 0,
      omw: omw.get(player.id) ?? 0,
      oomw: oomw.get(player.id) ?? 0,
    } satisfies StandingRow;
  });

  rows.sort((a, b) => {
    if (a.points !== b.points) return b.points - a.points;
    if (Math.abs(a.omw - b.omw) > EPSILON) return b.omw - a.omw;
    if (Math.abs(a.oomw - b.oomw) > EPSILON) return b.oomw - a.oomw;
    if (beat.has(`${a.playerId}|${b.playerId}`)) return -1;
    if (beat.has(`${b.playerId}|${a.playerId}`)) return 1;
    return (names.get(a.playerId) ?? "").localeCompare(names.get(b.playerId) ?? "");
  });

  rows.forEach((row, index) => {
    row.rank = index + 1;
  });
  return rows;
}

export type Rng = (maxExclusive: number) => number;

export const mathRandomRng: Rng = (max) => Math.floor(Math.random() * max);

export function shuffle<T>(items: T[], rng: Rng): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = rng(i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export type PairingPlan = {
  /** In table order: index 0 is table 1. */
  pairs: Array<[string, string]>;
  bye: string | null;
  /** True when a rematch could not be avoided. */
  rematches: boolean;
};

export function pairFirstRound(playerIds: string[], rng: Rng): PairingPlan {
  const order = shuffle(playerIds, rng);
  const bye = order.length % 2 === 1 ? order.pop()! : null;
  const pairs: Array<[string, string]> = [];
  for (let i = 0; i < order.length; i += 2) pairs.push([order[i], order[i + 1]]);
  return { pairs, bye, rematches: false };
}

const SEARCH_BUDGET = 200_000;

function search(
  list: string[],
  played: Set<string>,
  budget: { steps: number },
): Array<[string, string]> | null {
  if (list.length === 0) return [];
  const [first, ...rest] = list;
  for (let j = 0; j < rest.length; j += 1) {
    budget.steps += 1;
    if (budget.steps > SEARCH_BUDGET) return null;
    const candidate = rest[j];
    if (played.has(pairKey(first, candidate))) continue;
    const remaining = rest.slice(0, j).concat(rest.slice(j + 1));
    const sub = search(remaining, played, budget);
    if (sub) return [[first, candidate], ...sub];
  }
  return null;
}

/**
 * Pairs a Swiss round after round 1.
 * @param standings standings of the ACTIVE players, best first.
 * @param playedPairs pair keys (see `pairKey`) of matches already played.
 * @param hadBye players who already received a bye.
 */
export function pairNextRound(
  standings: Array<Pick<StandingRow, "playerId" | "points">>,
  playedPairs: Set<string>,
  hadBye: Set<string>,
  rng: Rng,
): PairingPlan {
  // Score groups best first; random order inside each group.
  const ordered = shuffle(standings, rng)
    .sort((a, b) => b.points - a.points)
    .map((row) => row.playerId);

  const byeCandidates: Array<string | null> = [];
  if (ordered.length % 2 === 1) {
    const fromBottom = [...standings].reverse().map((row) => row.playerId);
    const fresh = fromBottom.filter((id) => !hadBye.has(id));
    byeCandidates.push(...(fresh.length > 0 ? fresh : fromBottom));
  } else {
    byeCandidates.push(null);
  }

  for (const bye of byeCandidates) {
    const pool = bye ? ordered.filter((id) => id !== bye) : ordered;
    const pairs = search(pool, playedPairs, { steps: 0 });
    if (pairs) return { pairs, bye, rematches: false };
  }

  // Every option needs a rematch (tiny events or many rounds): pair in order.
  const bye = byeCandidates[0];
  const pool = bye ? ordered.filter((id) => id !== bye) : ordered;
  const pairs: Array<[string, string]> = [];
  for (let i = 0; i < pool.length; i += 2) pairs.push([pool[i], pool[i + 1]]);
  return { pairs, bye, rematches: true };
}

/** Match result from the games each side won. */
export function outcomeFromGames(player1Games: number, player2Games: number): MatchOutcome {
  if (player1Games > player2Games) return "PLAYER1_WIN";
  if (player2Games > player1Games) return "PLAYER2_WIN";
  return "DRAW";
}

/**
 * Validates a game score for a best-of-N match. Draw games (e.g. a game that
 * ended in a tie) are allowed. 0-0 is a draw (unfinished / intentional draw).
 */
export function isValidGameScore(
  bestOf: number,
  player1Games: number,
  player2Games: number,
  drawGames: number,
): boolean {
  const values = [player1Games, player2Games, drawGames];
  if (!values.every((v) => Number.isInteger(v) && v >= 0)) return false;
  const needed = Math.ceil(bestOf / 2);
  if (player1Games > needed || player2Games > needed) return false;
  if (player1Games === needed && player2Games === needed) return false;
  if (player1Games + player2Games + drawGames > bestOf + 2) return false;
  if (drawGames > bestOf) return false;
  return true;
}
