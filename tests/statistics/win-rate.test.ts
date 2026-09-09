import { describe, expect, it } from "vitest";

type MatchResult = "WIN" | "LOSS" | "DRAW" | "UNKNOWN";

function computeWinRate(results: MatchResult[]) {
  let wins = 0;
  let losses = 0;
  let draws = 0;
  let unknowns = 0;
  for (const result of results) {
    if (result === "WIN") wins += 1;
    else if (result === "LOSS") losses += 1;
    else if (result === "DRAW") draws += 1;
    else unknowns += 1;
  }
  const decided = wins + losses;
  return {
    matches: results.length,
    wins,
    losses,
    draws,
    unknowns,
    winRate: decided === 0 ? null : wins / decided,
  };
}

describe("win rate formula", () => {
  it("exclui DRAW e UNKNOWN do denominador", () => {
    const stats = computeWinRate([
      "WIN",
      "WIN",
      "WIN",
      "WIN",
      "WIN",
      "WIN",
      "WIN",
      "WIN",
      "LOSS",
      "LOSS",
      "DRAW",
      "DRAW",
    ]);
    expect(stats.matches).toBe(12);
    expect(stats.wins).toBe(8);
    expect(stats.losses).toBe(2);
    expect(stats.draws).toBe(2);
    expect(stats.winRate).toBe(0.8);
  });

  it("retorna null quando não há partidas decididas", () => {
    expect(computeWinRate(["DRAW", "UNKNOWN"]).winRate).toBeNull();
  });
});
