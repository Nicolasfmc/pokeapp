import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  LIMITLESS_PARSER_VERSION,
  parseLimitlessDecklist,
  parseLimitlessLine,
} from "../../server/parsers";

function fixture(name: string): string {
  return readFileSync(
    join(process.cwd(), "tests/fixtures/limitless", name),
    "utf8",
  );
}

describe("parseLimitlessLine", () => {
  it("parseia linha simples", () => {
    const result = parseLimitlessLine("4 Dreepy TWM 128");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toEqual({
      quantity: 4,
      name: "Dreepy",
      setCode: "TWM",
      collectorNumber: "128",
    });
  });

  it("parseia nomes com múltiplos tokens", () => {
    const result = parseLimitlessLine("4 Lillie's Determination MEG 119");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toEqual({
      quantity: 4,
      name: "Lillie's Determination",
      setCode: "MEG",
      collectorNumber: "119",
    });
  });

  it("parseia Buddy-Buddy Poffin", () => {
    const result = parseLimitlessLine("4 Buddy-Buddy Poffin TEF 144");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.name).toBe("Buddy-Buddy Poffin");
    expect(result.value.setCode).toBe("TEF");
    expect(result.value.collectorNumber).toBe("144");
  });

  it("retorna erro tipado para tokens insuficientes", () => {
    const result = parseLimitlessLine("2 Buddy-Buddy", 3);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("INSUFFICIENT_TOKENS");
    expect(result.error.lineNumber).toBe(3);
    expect(result.error.raw).toBe("2 Buddy-Buddy");
  });

  it("retorna erro tipado para quantidade inválida", () => {
    const result = parseLimitlessLine("x Dreepy TWM 128");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("INVALID_QUANTITY");
  });

  it("retorna erro tipado para quantidade zero", () => {
    const result = parseLimitlessLine("0 Dreepy TWM 128");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("INVALID_QUANTITY");
  });
});

describe("parseLimitlessDecklist", () => {
  it("parseia fixture Dragapult e expõe parser_version", () => {
    const result = parseLimitlessDecklist(fixture("dragapult-sample.txt"));
    expect(result.parser_version).toBe(LIMITLESS_PARSER_VERSION);
    expect(result.errors).toEqual([]);
    expect(result.sections.map((s) => s.kind)).toEqual([
      "Pokemon",
      "Trainer",
      "Energy",
    ]);
    expect(result.sections[0]?.declaredCount).toBe(19);
    expect(result.sections[1]?.declaredCount).toBe(32);
    expect(result.sections[2]?.declaredCount).toBe(9);
    expect(result.cards).toHaveLength(27);
    const totalQty = result.cards.reduce((sum, card) => sum + card.quantity, 0);
    expect(totalQty).toBe(60);
    expect(result.cards[0]).toEqual({
      quantity: 4,
      name: "Dreepy",
      setCode: "TWM",
      collectorNumber: "128",
    });
  });

  it("acumula erros tipados por linha inválida", () => {
    const result = parseLimitlessDecklist(fixture("invalid-lines.txt"));
    expect(result.parser_version).toBe(LIMITLESS_PARSER_VERSION);
    expect(result.cards).toHaveLength(1);
    expect(result.cards[0]?.name).toBe("Dreepy");
    expect(result.sections).toHaveLength(1);
    expect(result.errors.length).toBeGreaterThanOrEqual(3);
    expect(result.errors.every((e) => e.code && e.message)).toBe(true);
    expect(result.errors.some((e) => e.code === "INSUFFICIENT_TOKENS")).toBe(
      true,
    );
    expect(result.errors.some((e) => e.code === "INVALID_QUANTITY")).toBe(true);
  });

  it("retorna EMPTY_INPUT para decklist vazia", () => {
    const result = parseLimitlessDecklist("   \n  ");
    expect(result.cards).toEqual([]);
    expect(result.errors[0]?.code).toBe("EMPTY_INPUT");
  });
});
