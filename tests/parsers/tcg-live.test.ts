import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  TCG_LIVE_PARSER_VERSION,
  parseTcgLiveBattleLog,
} from "../../server/parsers";

function fixture(name: string): string {
  return readFileSync(
    join(process.cwd(), "tests/fixtures/tcg-live", name),
    "utf8",
  );
}

describe("parseTcgLiveBattleLog", () => {
  it("extrai StructuredMatchData mínimo da fixture Ayesai vs nicolasfmc", () => {
    const raw = fixture("ayesai-vs-nicolasfmc.txt");
    const { ok, value } = parseTcgLiveBattleLog(raw, {
      viewerName: "nicolasfmc",
    });

    expect(ok).toBe(true);
    expect(value.parser_version).toBe(TCG_LIVE_PARSER_VERSION);
    expect(value.source).toBe("TCG_LIVE");
    expect(value.raw_log).toBe(raw);
    expect(value.player1).toBe("Ayesai");
    expect(value.player2).toBe("nicolasfmc");
    expect(value.viewer).toBe("nicolasfmc");
    expect(value.format).toBe("TEF-PBL");
    expect(value.going_first_player).toBe("Ayesai");
    expect(value.turn_order).toBe("SECOND");
    expect(value.winner).toBe("Ayesai");
    expect(value.result).toBe("LOSS");
    expect(value.errors).toEqual([]);
  });

  it("resolve WIN e FIRST para o viewer vencedor que começou", () => {
    const raw = fixture("ayesai-vs-nicolasfmc.txt");
    const { value } = parseTcgLiveBattleLog(raw, { viewerName: "Ayesai" });

    expect(value.result).toBe("WIN");
    expect(value.turn_order).toBe("FIRST");
  });

  it("preserva raw_log imutável mesmo com erros", () => {
    const raw = fixture("invalid-missing-vs.txt");
    const { ok, value } = parseTcgLiveBattleLog(raw, {
      viewerName: "SoloPlayer",
    });

    expect(ok).toBe(false);
    expect(value.raw_log).toBe(raw);
    expect(value.parser_version).toBe(TCG_LIVE_PARSER_VERSION);
    expect(value.errors.some((e) => e.code === "MISSING_PLAYERS")).toBe(true);
    expect(value.result).toBe("WIN");
    expect(value.turn_order).toBe("FIRST");
    expect(value.format).toBe("Standard");
  });

  it("mapeia códigos W/L/D sem inventar campos", () => {
    const raw = [
      "Alice vs Bob",
      "Format: TEF-PBL",
      "Result: D",
      "Turn Order: SECOND",
    ].join("\n");

    const { ok, value } = parseTcgLiveBattleLog(raw, { viewerName: "Alice" });
    expect(ok).toBe(true);
    expect(value.result).toBe("DRAW");
    expect(value.turn_order).toBe("SECOND");
    expect(value.format).toBe("TEF-PBL");
    expect(value.winner).toBeNull();
  });

  it("retorna UNKNOWN sem viewer e sem código de resultado", () => {
    const raw = fixture("ayesai-vs-nicolasfmc.txt");
    const { value } = parseTcgLiveBattleLog(raw);

    expect(value.viewer).toBeNull();
    expect(value.result).toBe("UNKNOWN");
    expect(value.turn_order).toBeNull();
    expect(value.winner).toBe("Ayesai");
    expect(value.going_first_player).toBe("Ayesai");
  });

  it("extrai Pokémon colocados em campo por jogador e o oponente (§67)", () => {
    const raw = fixture("ayesai-vs-nicolasfmc.txt");
    const { value } = parseTcgLiveBattleLog(raw, { viewerName: "nicolasfmc" });

    expect(value.opponent).toBe("Ayesai");
    expect(value.pokemon_by_player.Ayesai).toEqual(["Dreepy"]);
    // Nest Ball é trainer ("played X." sem destino em campo): não conta.
    expect(value.pokemon_by_player.nicolasfmc).toEqual([]);
  });

  it("registra evoluções e ignora jogadores desconhecidos", () => {
    const raw = [
      "Alice vs Bob",
      "Alice played (twm_128) Dreepy to the Active Spot.",
      "Alice's (twm_128) Dreepy evolved into (twm_129) Drakloak on the Bench.",
      "Alice's Drakloak evolved into Dragapult ex.",
      "Bob played Abra to the Bench.",
      "Carol played Pikachu to the Bench.",
    ].join("\n");
    const { value } = parseTcgLiveBattleLog(raw, { viewerName: "Bob" });
    expect(value.opponent).toBe("Alice");
    expect(value.pokemon_by_player.Alice).toEqual(["Dreepy", "Drakloak", "Dragapult ex"]);
    expect(value.pokemon_by_player.Bob).toEqual(["Abra"]);
    expect(value.pokemon_by_player.Carol).toBeUndefined();
  });

  it("retorna EMPTY_INPUT para log vazio", () => {
    const { ok, value } = parseTcgLiveBattleLog("   ");
    expect(ok).toBe(false);
    expect(value.errors[0]?.code).toBe("EMPTY_INPUT");
    expect(value.raw_log).toBe("   ");
  });
});
