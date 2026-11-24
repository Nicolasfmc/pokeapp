import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildCardImageUrl,
  logicalCardKey,
  mapTcgdexCategory,
  normalizeCard,
  normalizeSet,
  parseReleaseDate,
  parseTcgdexUpdatedAt,
} from "../../server/tcgdex/normalize";
import type {
  TcgdexCardNormalizeInput,
  TcgdexSetNormalizeInput,
} from "../../server/tcgdex/types";

function fixture<T>(name: string): T {
  return JSON.parse(
    readFileSync(join(process.cwd(), "tests/fixtures/tcgdex", name), "utf8"),
  ) as T;
}

describe("mapTcgdexCategory", () => {
  it("mapeia categorias conhecidas", () => {
    expect(mapTcgdexCategory("Pokemon")).toBe("POKEMON");
    expect(mapTcgdexCategory("Trainer")).toBe("TRAINER");
    expect(mapTcgdexCategory("Energy")).toBe("ENERGY");
  });

  it("rejeita categoria desconhecida", () => {
    expect(() => mapTcgdexCategory("Item")).toThrow(/desconhecida/i);
  });
});

describe("buildCardImageUrl", () => {
  it("anexa high.webp na base da TCGdex", () => {
    expect(
      buildCardImageUrl("https://assets.tcgdex.net/en/swsh/swsh3/136"),
    ).toBe("https://assets.tcgdex.net/en/swsh/swsh3/136/high.webp");
  });

  it("preserva URL já com extensão", () => {
    expect(
      buildCardImageUrl("https://assets.tcgdex.net/en/swsh/swsh3/136/high.webp"),
    ).toBe("https://assets.tcgdex.net/en/swsh/swsh3/136/high.webp");
  });

  it("retorna null sem imagem", () => {
    expect(buildCardImageUrl(null)).toBeNull();
    expect(buildCardImageUrl(undefined)).toBeNull();
  });
});

describe("normalizeSet", () => {
  it("normaliza set completo", () => {
    const raw = fixture<TcgdexSetNormalizeInput>("set-swsh3.json");
    expect(normalizeSet(raw)).toEqual({
      tcgdexId: "swsh3",
      name: "Darkness Ablaze",
      code: "DAA",
      series: "Sword & Shield",
      seriesId: "swsh",
      releaseDate: "2020-08-14",
      logoUrl: "https://assets.tcgdex.net/en/swsh/swsh3/logo",
      symbolUrl: "https://assets.tcgdex.net/univ/swsh/swsh3/symbol",
    });
  });

  it("usa tcgOnline quando abbreviation falta", () => {
    expect(
      normalizeSet({
        id: "swsh3",
        name: "Darkness Ablaze",
        tcgOnline: "DAA",
      }),
    ).toMatchObject({ code: "DAA", series: null, seriesId: null });
  });
});

describe("normalizeCard", () => {
  it("normaliza carta completa", () => {
    const raw = fixture<TcgdexCardNormalizeInput>("card-furret.json");
    expect(normalizeCard(raw)).toEqual({
      tcgdexId: "swsh3-136",
      localId: "136",
      name: "Furret",
      category: "POKEMON",
      setTcgdexId: "swsh3",
      rarity: "Uncommon",
      illustrator: "tetsuya koizumi",
      regulationMark: "D",
      legalStandard: false,
      legalExpanded: true,
      imageUrl: "https://assets.tcgdex.net/en/swsh/swsh3/136/high.webp",
      tcgdexUpdatedAt: "2026-07-01T21:27:44+01:00",
      energyType: null,
    });
  });

  it("normaliza trainer e defaults de legalidade", () => {
    const raw = fixture<TcgdexCardNormalizeInput>("card-buddy-poffin.json");
    const card = normalizeCard(raw);
    expect(card.category).toBe("TRAINER");
    expect(card.legalStandard).toBe(true);
    expect(logicalCardKey(card.name, card.category)).toEqual({
      canonicalName: "Buddy-Buddy Poffin",
      category: "TRAINER",
    });
  });

  it("aceita payload mínimo", () => {
    const raw = fixture<TcgdexCardNormalizeInput>("card-minimal.json");
    expect(normalizeCard(raw)).toEqual({
      tcgdexId: "base1-4",
      localId: "4",
      name: "Charmander",
      category: "POKEMON",
      setTcgdexId: "base1",
      rarity: "Common",
      illustrator: null,
      regulationMark: null,
      legalStandard: false,
      legalExpanded: false,
      imageUrl: null,
      tcgdexUpdatedAt: null,
      energyType: null,
    });
  });
});

describe("logicalCardKey", () => {
  it("unifica 'Basic X Energy' e 'X Energy' para energia básica", () => {
    expect(logicalCardKey("Basic Fire Energy", "ENERGY", "Normal").canonicalName).toBe(
      "Fire Energy",
    );
    expect(logicalCardKey("Fire Energy", "ENERGY", "Normal").canonicalName).toBe(
      "Fire Energy",
    );
  });

  it("não altera energia especial", () => {
    expect(
      logicalCardKey("Basic Something Energy", "ENERGY", "Special").canonicalName,
    ).toBe("Basic Something Energy");
  });
});

describe("parse datas", () => {
  it("parseia releaseDate UTC", () => {
    expect(parseReleaseDate("2020-08-14")?.toISOString()).toBe(
      "2020-08-14T00:00:00.000Z",
    );
    expect(parseReleaseDate(null)).toBeNull();
  });

  it("parseia tcgdexUpdatedAt", () => {
    expect(
      parseTcgdexUpdatedAt("2026-07-01T21:27:44+01:00")?.toISOString(),
    ).toBe("2026-07-01T20:27:44.000Z");
    expect(parseTcgdexUpdatedAt("não-é-data")).toBeNull();
  });
});
