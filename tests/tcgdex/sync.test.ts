import { describe, expect, it, vi } from "vitest";
import { persistCatalog } from "../../server/tcgdex/sync";
import type { ExternalCard, ExternalSet } from "../../server/tcgdex/types";

function buildPrismaMock() {
  const sets = new Map<string, { id: string; tcgdexId: string; isActive: boolean }>();
  const logicals = new Map<string, { id: string; canonicalName: string; category: string }>();
  const printings = new Map<
    string,
    { id: string; tcgdexId: string; isActive: boolean; name: string; [key: string]: unknown }
  >();

  let seq = 1;
  const nextId = () => `id-${seq++}`;

  return {
    cardSet: {
      upsert: vi.fn(async ({ where, create, update }) => {
        const existing = sets.get(where.tcgdexId);
        if (existing) {
          Object.assign(existing, update, { isActive: true });
          return existing;
        }
        const created = { id: nextId(), tcgdexId: create.tcgdexId, isActive: true };
        sets.set(create.tcgdexId, created);
        return created;
      }),
      findMany: vi.fn(async ({ where }) =>
        [...sets.values()].filter((s) => where.isActive === undefined || s.isActive === where.isActive),
      ),
      updateMany: vi.fn(async ({ where, data }) => {
        let count = 0;
        for (const set of sets.values()) {
          if (where.id?.in?.includes(set.id)) {
            set.isActive = data.isActive;
            count += 1;
          }
        }
        return { count };
      }),
    },
    cardLogical: {
      findUnique: vi.fn(async ({ where }) => {
        const compound = where.canonicalName_category;
        if (!compound) return null;
        for (const logical of logicals.values()) {
          if (
            logical.canonicalName === compound.canonicalName &&
            logical.category === compound.category
          ) {
            return logical;
          }
        }
        return null;
      }),
      create: vi.fn(async ({ data }) => {
        const created = {
          id: nextId(),
          canonicalName: data.canonicalName,
          category: data.category,
        };
        logicals.set(created.id, created);
        return created;
      }),
    },
    cardPrinting: {
      upsert: vi.fn(async ({ where, create, update }) => {
        const existing = printings.get(where.tcgdexId);
        if (existing) {
          Object.assign(existing, update, { isActive: true });
          return existing;
        }
        const created = { ...create, id: nextId(), isActive: true };
        printings.set(create.tcgdexId, created);
        return created;
      }),
      findMany: vi.fn(async ({ where }) =>
        [...printings.values()].filter((p) => {
          if (where.tcgdexId?.in) return where.tcgdexId.in.includes(p.tcgdexId);
          return where.isActive === undefined || p.isActive === where.isActive;
        }),
      ),
      updateMany: vi.fn(async ({ where, data }) => {
        let count = 0;
        for (const printing of printings.values()) {
          if (where.id?.in?.includes(printing.id)) {
            printing.isActive = data.isActive;
            count += 1;
          }
        }
        return { count };
      }),
    },
    $transaction: vi.fn(),
    _sets: sets,
    _printings: printings,
    _logicals: logicals,
  };
}

const setA: ExternalSet = {
  tcgdexId: "swsh3",
  name: "Darkness Ablaze",
  code: "DAA",
  series: "Sword & Shield",
  seriesId: "swsh",
  releaseDate: "2020-08-14",
  logoUrl: null,
  symbolUrl: null,
};

const cardA: ExternalCard = {
  tcgdexId: "swsh3-136",
  localId: "136",
  name: "Furret",
  category: "POKEMON",
  setTcgdexId: "swsh3",
  rarity: "Uncommon",
  illustrator: null,
  regulationMark: "D",
  legalStandard: false,
  legalExpanded: true,
  imageUrl: null,
  tcgdexUpdatedAt: null,
};

const cardB: ExternalCard = {
  ...cardA,
  tcgdexId: "swsh3-1",
  localId: "1",
  name: "Butterfree V",
};

describe("persistCatalog", () => {
  it("faz upsert e soft-delete de remoções sem hard delete", async () => {
    const prisma = buildPrismaMock();

    const first = await persistCatalog(prisma as never, {
      sets: [setA],
      cards: [cardA, cardB],
    });

    expect(first.setsUpserted).toBe(1);
    expect(first.cardsUpserted).toBe(2);
    expect(first.logicalsCreated).toBe(2);
    expect(prisma._printings.size).toBe(2);

    const second = await persistCatalog(prisma as never, {
      sets: [setA],
      cards: [cardA],
    });

    expect(second.cardsUnchanged).toBe(1);
    expect(second.cardsDeactivated).toBe(1);
    expect(prisma._printings.get("swsh3-1")?.isActive).toBe(false);
    expect(prisma._printings.has("swsh3-1")).toBe(true);
    expect(prisma.cardPrinting.updateMany).toHaveBeenCalled();
  });

  it("reusa CardLogical por nome+categoria", async () => {
    const prisma = buildPrismaMock();
    const reprint: ExternalCard = {
      ...cardA,
      tcgdexId: "sv3-10",
      localId: "10",
      setTcgdexId: "swsh3",
    };

    await persistCatalog(prisma as never, {
      sets: [setA],
      cards: [cardA, reprint],
    });

    expect(prisma._logicals.size).toBe(1);
    expect(prisma.cardLogical.create).toHaveBeenCalledTimes(1);
  });

  it("classifica NEW / UPDATED / UNCHANGED / REMOVED (§11.2)", async () => {
    const prisma = buildPrismaMock();
    await persistCatalog(prisma as never, { sets: [setA], cards: [cardA, cardB] });

    const changedA: ExternalCard = { ...cardA, legalStandard: true };
    const cardC: ExternalCard = { ...cardA, tcgdexId: "swsh3-2", localId: "2", name: "Caterpie" };
    const stats = await persistCatalog(prisma as never, {
      sets: [setA],
      cards: [changedA, cardC],
    });

    expect(stats.cardsNew).toBe(1);
    expect(stats.cardsUpdated).toBe(1);
    expect(stats.cardsUnchanged).toBe(0);
    expect(stats.cardsRemoved).toBe(1);

    const again = await persistCatalog(prisma as never, {
      sets: [setA],
      cards: [changedA, cardC],
    });
    expect(again.cardsUnchanged).toBe(2);
    expect(again.cardsNew + again.cardsUpdated).toBe(0);
  });

  it("sync parcial não desativa cartas fora do recorte", async () => {
    const prisma = buildPrismaMock();
    await persistCatalog(prisma as never, { sets: [setA], cards: [cardA, cardB] });
    const stats = await persistCatalog(
      prisma as never,
      { sets: [setA], cards: [cardA] },
      { partial: true },
    );
    expect(stats.cardsRemoved).toBe(0);
    expect(prisma._printings.get("swsh3-1")?.isActive).toBe(true);
  });

  it("energia básica 'Basic Fire Energy' e 'Fire Energy' compartilham carta lógica (§18)", async () => {
    const prisma = buildPrismaMock();
    const fire: ExternalCard = {
      ...cardA,
      tcgdexId: "mee-002",
      localId: "002",
      name: "Fire Energy",
      category: "ENERGY",
      energyType: "Normal",
    };
    const basicFire: ExternalCard = {
      ...fire,
      tcgdexId: "sve-002",
      localId: "2",
      name: "Basic Fire Energy",
    };
    await persistCatalog(prisma as never, { sets: [setA], cards: [fire, basicFire] });
    expect(prisma._logicals.size).toBe(1);
    expect([...prisma._logicals.values()][0].canonicalName).toBe("Fire Energy");
  });

  it("aborta catálogo vazio", async () => {
    const prisma = buildPrismaMock();
    await expect(
      persistCatalog(prisma as never, { sets: [], cards: [] }),
    ).rejects.toThrow(/vazio/i);
  });
});
