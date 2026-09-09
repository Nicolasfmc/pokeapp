import { describe, expect, it } from "vitest";
import {
  buildLogicalWhere,
  buildPrintingWhere,
  parseCardSearchParams,
} from "../../modules/cards/query";

describe("parseCardSearchParams", () => {
  it("aplica defaults e parseia filtros principais", () => {
    const params = parseCardSearchParams(
      new URLSearchParams(
        "q=poffin&category=TRAINER&format=standard&regulationMark=G&setCode=TEF&page=2&pageSize=12",
      ),
    );

    expect(params).toMatchObject({
      q: "poffin",
      category: "TRAINER",
      format: "standard",
      regulationMark: "G",
      setCode: "TEF",
      page: 2,
      pageSize: 12,
      isActive: true,
      mode: "printing",
    });
  });

  it("rejeita categoria inválida", () => {
    expect(() =>
      parseCardSearchParams(new URLSearchParams("category=ITEM")),
    ).toThrow(/Categoria inválida/i);
  });

  it("limita pageSize ao máximo", () => {
    const params = parseCardSearchParams(
      new URLSearchParams("pageSize=999"),
    );
    expect(params.pageSize).toBe(100);
  });

  it("aceita mode logical", () => {
    const params = parseCardSearchParams(
      new URLSearchParams("mode=logical"),
    );
    expect(params.mode).toBe("logical");
  });
});

describe("buildPrintingWhere", () => {
  it("monta filtros de texto, legalidade e set", () => {
    const where = buildPrintingWhere({
      q: "Buddy",
      category: "TRAINER",
      format: "standard",
      setCode: "TEF",
      regulationMark: "G",
      rarity: "Uncommon",
      isActive: true,
    });

    expect(where).toEqual({
      AND: expect.arrayContaining([
        { isActive: true },
        {
          OR: expect.arrayContaining([
            { name: { contains: "Buddy", mode: "insensitive" } },
          ]),
        },
        { category: "TRAINER" },
        { rarity: { equals: "Uncommon", mode: "insensitive" } },
        {
          regulationMark: { equals: "G", mode: "insensitive" },
        },
        { legalStandard: true },
        {
          set: {
            code: { equals: "TEF", mode: "insensitive" },
            isActive: true,
          },
        },
      ]),
    });
  });
});

describe("buildLogicalWhere", () => {
  it("filtra por nome canônico e printings relacionados", () => {
    const where = buildLogicalWhere({
      q: "Poffin",
      category: "TRAINER",
      format: "expanded",
      isActive: true,
    });

    expect(where).toEqual({
      AND: [
        { canonicalName: { contains: "Poffin", mode: "insensitive" } },
        { category: "TRAINER" },
        {
          printings: {
            some: {
              AND: [{ isActive: true }, { legalExpanded: true }],
            },
          },
        },
      ],
    });
  });
});
