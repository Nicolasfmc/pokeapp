import { describe, expect, it } from "vitest";
import {
  computeStandings,
  isValidGameScore,
  outcomeFromGames,
  pairFirstRound,
  pairKey,
  pairNextRound,
  suggestedRounds,
  type Rng,
  type SwissPlayer,
  type SwissResult,
} from "@/server/services/hosted-tournament/swiss";

const RULES = { win: 3, draw: 1, loss: 0 };

function seeded(seed: number): Rng {
  let state = seed;
  return (max) => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state % max;
  };
}

function players(count: number): SwissPlayer[] {
  return Array.from({ length: count }, (_, i) => ({ id: `p${i + 1}`, name: `Player ${i + 1}`, active: true }));
}

describe("suggestedRounds", () => {
  it("follows ceil(log2(n))", () => {
    expect(suggestedRounds(2)).toBe(1);
    expect(suggestedRounds(4)).toBe(2);
    expect(suggestedRounds(5)).toBe(3);
    expect(suggestedRounds(8)).toBe(3);
    expect(suggestedRounds(9)).toBe(4);
    expect(suggestedRounds(16)).toBe(4);
    expect(suggestedRounds(17)).toBe(5);
    expect(suggestedRounds(64)).toBe(6);
  });
});

describe("pairFirstRound", () => {
  it("pairs everyone once and gives a bye only when odd", () => {
    const even = pairFirstRound(["a", "b", "c", "d"], seeded(1));
    expect(even.bye).toBeNull();
    expect(even.pairs.flat().sort()).toEqual(["a", "b", "c", "d"]);

    const odd = pairFirstRound(["a", "b", "c", "d", "e"], seeded(2));
    expect(odd.bye).not.toBeNull();
    expect([...odd.pairs.flat(), odd.bye].sort()).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("randomizes who gets the round 1 bye", () => {
    const byes = new Set<string | null>();
    for (let seed = 1; seed < 40; seed += 1) {
      byes.add(pairFirstRound(["a", "b", "c", "d", "e"], seeded(seed)).bye);
    }
    expect(byes.size).toBeGreaterThan(1);
  });
});

describe("computeStandings", () => {
  it("counts points, records and byes", () => {
    const results: SwissResult[] = [
      { player1Id: "p1", player2Id: "p2", outcome: "PLAYER1_WIN" },
      { player1Id: "p3", player2Id: "p4", outcome: "DRAW" },
      { player1Id: "p5", player2Id: null, outcome: "PLAYER1_WIN" },
    ];
    const rows = computeStandings(players(5), results, RULES);
    const byId = new Map(rows.map((r) => [r.playerId, r]));
    expect(byId.get("p1")).toMatchObject({ points: 3, wins: 1, losses: 0, draws: 0 });
    expect(byId.get("p2")).toMatchObject({ points: 0, wins: 0, losses: 1 });
    expect(byId.get("p3")).toMatchObject({ points: 1, draws: 1 });
    expect(byId.get("p5")).toMatchObject({ points: 3, wins: 1, byes: 1, matchesPlayed: 0 });
  });

  it("uses custom point values", () => {
    const rows = computeStandings(
      players(2),
      [{ player1Id: "p1", player2Id: "p2", outcome: "DRAW" }],
      { win: 2, draw: 1, loss: 0 },
    );
    expect(rows.map((r) => r.points)).toEqual([1, 1]);
  });

  it("breaks ties by opponents' win rate", () => {
    // p1 and p3 both 1-1. p1 lost to p2 (2-0), p3 lost to p4 (1-1).
    const results: SwissResult[] = [
      { player1Id: "p1", player2Id: "p5", outcome: "PLAYER1_WIN" },
      { player1Id: "p2", player2Id: "p6", outcome: "PLAYER1_WIN" },
      { player1Id: "p3", player2Id: "p6", outcome: "PLAYER1_WIN" },
      { player1Id: "p4", player2Id: "p5", outcome: "PLAYER1_WIN" },
      { player1Id: "p2", player2Id: "p1", outcome: "PLAYER1_WIN" },
      { player1Id: "p4", player2Id: "p3", outcome: "PLAYER1_WIN" },
      { player1Id: "p2", player2Id: "p4", outcome: "PLAYER1_WIN" },
      { player1Id: "p5", player2Id: "p6", outcome: "PLAYER1_WIN" },
    ];
    const rows = computeStandings(players(6), results, RULES);
    const order = rows.map((r) => r.playerId);
    expect(order[0]).toBe("p2");
    expect(order[1]).toBe("p4");
    const p1 = rows.find((r) => r.playerId === "p1")!;
    const p3 = rows.find((r) => r.playerId === "p3")!;
    expect(p1.points).toBe(p3.points);
    // p1's opponents (p5 1-2, p2 3-0) beat p3's (p6 0-3, p4 2-1)
    expect(p1.omw).toBeGreaterThan(p3.omw);
    expect(order.indexOf("p1")).toBeLessThan(order.indexOf("p3"));
  });

  it("applies the 25% floor and ignores byes in tiebreakers", () => {
    const rows = computeStandings(
      players(3),
      [
        { player1Id: "p1", player2Id: "p2", outcome: "PLAYER1_WIN" },
        { player1Id: "p3", player2Id: null, outcome: "PLAYER1_WIN" },
      ],
      RULES,
    );
    const p1 = rows.find((r) => r.playerId === "p1")!;
    const p3 = rows.find((r) => r.playerId === "p3")!;
    expect(p1.omw).toBeCloseTo(0.25);
    expect(p3.omw).toBe(0);
    expect(p3.matchesPlayed).toBe(0);
  });

  it("uses head-to-head when everything else ties", () => {
    const rows = computeStandings(
      players(2),
      [{ player1Id: "p2", player2Id: "p1", outcome: "PLAYER1_WIN" }],
      { win: 3, draw: 1, loss: 3 },
    );
    expect(rows[0].points).toBe(rows[1].points);
    expect(rows[0].playerId).toBe("p2");
  });
});

describe("pairNextRound", () => {
  it("pairs inside score groups and never repeats an opponent", () => {
    const list = players(8);
    const played = new Set<string>();
    const hadBye = new Set<string>();
    const results: SwissResult[] = [];
    const rng = seeded(7);

    const r1 = pairFirstRound(list.map((p) => p.id), rng);
    for (const [a, b] of r1.pairs) {
      played.add(pairKey(a, b));
      results.push({ player1Id: a, player2Id: b, outcome: "PLAYER1_WIN" });
    }

    for (let round = 2; round <= 3; round += 1) {
      const standings = computeStandings(list, results, RULES);
      const plan = pairNextRound(standings, played, hadBye, rng);
      expect(plan.rematches).toBe(false);
      const pointsOf = new Map(standings.map((s) => [s.playerId, s.points]));
      for (const [a, b] of plan.pairs) {
        expect(played.has(pairKey(a, b))).toBe(false);
        // with 8 players and all decisive results, groups are even: same score
        expect(pointsOf.get(a)).toBe(pointsOf.get(b));
        played.add(pairKey(a, b));
        results.push({ player1Id: a, player2Id: b, outcome: "PLAYER1_WIN" });
      }
      // table 1 holds the best record
      const best = Math.max(...standings.map((s) => s.points));
      expect(pointsOf.get(plan.pairs[0][0])).toBe(best);
    }
  });

  it("floats a player down when a score group is odd", () => {
    const standings = [
      { playerId: "a", points: 6 },
      { playerId: "b", points: 3 },
      { playerId: "c", points: 3 },
      { playerId: "d", points: 3 },
      { playerId: "e", points: 0 },
      { playerId: "f", points: 0 },
    ];
    const plan = pairNextRound(standings, new Set(), new Set(), seeded(3));
    const opponentOfA = plan.pairs.find((p) => p.includes("a"))!.find((id) => id !== "a")!;
    expect(["b", "c", "d"]).toContain(opponentOfA);
    expect(plan.bye).toBeNull();
  });

  it("gives the bye to the lowest-ranked player without one", () => {
    const standings = [
      { playerId: "a", points: 6 },
      { playerId: "b", points: 3 },
      { playerId: "c", points: 3 },
      { playerId: "d", points: 0 },
      { playerId: "e", points: 0 },
    ];
    const plan = pairNextRound(standings, new Set(), new Set(["e"]), seeded(5));
    expect(plan.bye).toBe("d");
    expect(plan.pairs.flat()).not.toContain("d");
  });

  it("picks another bye if the lowest one makes pairing impossible", () => {
    // b and c already played; a must take the bye so b and c... can't. Give
    // the bye to c instead: a-b is fresh.
    const standings = [
      { playerId: "a", points: 3 },
      { playerId: "b", points: 3 },
      { playerId: "c", points: 0 },
    ];
    const played = new Set([pairKey("a", "b")]);
    const plan = pairNextRound(standings, played, new Set(), seeded(1));
    expect(plan.rematches).toBe(false);
    expect(plan.bye).not.toBe("c");
  });

  it("falls back to a rematch only when nothing else works", () => {
    const standings = [
      { playerId: "a", points: 3 },
      { playerId: "b", points: 0 },
    ];
    const plan = pairNextRound(standings, new Set([pairKey("a", "b")]), new Set(), seeded(1));
    expect(plan.rematches).toBe(true);
    expect(plan.pairs).toHaveLength(1);
  });
});

describe("game scores", () => {
  it("derives the match result from games", () => {
    expect(outcomeFromGames(2, 1)).toBe("PLAYER1_WIN");
    expect(outcomeFromGames(0, 1)).toBe("PLAYER2_WIN");
    expect(outcomeFromGames(1, 1)).toBe("DRAW");
    expect(outcomeFromGames(0, 0)).toBe("DRAW");
  });

  it("validates best-of-1 and best-of-3 scores", () => {
    expect(isValidGameScore(1, 1, 0, 0)).toBe(true);
    expect(isValidGameScore(1, 0, 0, 1)).toBe(true);
    expect(isValidGameScore(1, 2, 0, 0)).toBe(false);
    expect(isValidGameScore(3, 2, 1, 0)).toBe(true);
    expect(isValidGameScore(3, 1, 1, 1)).toBe(true);
    expect(isValidGameScore(3, 2, 2, 0)).toBe(false);
    expect(isValidGameScore(3, 3, 0, 0)).toBe(false);
    expect(isValidGameScore(3, -1, 0, 0)).toBe(false);
    expect(isValidGameScore(3, 1.5, 0, 0)).toBe(false);
  });
});
