import { describe, expect, it, vi } from "vitest";
import { persistCatalog } from "../../server/tcgdex/sync";
import type { ExternalCard, ExternalSet } from "../../server/tcgdex/types";

function buildPrismaMock() {
  const sets = new Map<string, { id: string; tcgdexId: string; isActive: boolean; releaseDate?: Date | null; standardOverride?: boolean | null }>();
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
        const created = { ...create, id: nextId(), isActive: true };
        sets.set(create.tcgdexId, created);
        return created;
      }),
      // Newest set holding a Standard-legal printing (loadStandardReference).
      findFirst: vi.fn(async ({ where }) => {
        const excluded: string[] = where?.id?.notIn ?? [];
        const legalSetIds = new Set(
          [...printings.values()].filter((p) => p.legalStandardAuto).map((p) => p.setId),
        );
        const candidates = [...sets.values()]
          .filter((set) => legalSetIds.has(set.id) && set.releaseDate && !excluded.includes(set.id))
          .sort((a, b) => b.releaseDate!.getTime() - a.releaseDate!.getTime());
        return candidates[0] ? { releaseDate: candidates[0].releaseDate } : null;
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
          if (where.legalStandardAuto !== undefined)
            return (
              p.legalStandardAuto === where.legalStandardAuto &&
              p.regulationMark != null &&
              !(where.setId?.notIn ?? []).includes(p.setId)
            );
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

describe("Standard legality of sets TCGdex has not classified yet", () => {
  const svSet: ExternalSet = { ...setA, tcgdexId: "me05", name: "Older Set", releaseDate: "2026-08-01" };
  const newSet: ExternalSet = { ...setA, tcgdexId: "me06", name: "Delta Reign", releaseDate: "2026-11-06" };
  const legalOld: ExternalCard = {
    ...cardA,
    tcgdexId: "me05-1",
    setTcgdexId: "me05",
    name: "Rayquaza",
    regulationMark: "J",
    legalStandard: true,
  };
  const megaRayquaza: ExternalCard = {
    ...cardA,
    tcgdexId: "me06-084",
    localId: "084",
    setTcgdexId: "me06",
    name: "Mega Rayquaza ex",
    regulationMark: null,
    legalStandard: false,
    legalExpanded: true,
  };
  const stored = (prisma: ReturnType<typeof buildPrismaMock>, id: string) =>
    prisma._printings.get(id)?.legalStandard;

  it("marks cards of a newer, unclassified set as Standard", async () => {
    const prisma = buildPrismaMock();
    await persistCatalog(prisma as never, { sets: [svSet, newSet], cards: [legalOld, megaRayquaza] });
    expect(stored(prisma, "me06-084")).toBe(true);
  });

  it("keeps rotated marks, non-Expanded cards and older sets out", async () => {
    const prisma = buildPrismaMock();
    const rotated: ExternalCard = { ...megaRayquaza, tcgdexId: "me06-2", localId: "2", regulationMark: "G" };
    const notExpanded: ExternalCard = { ...megaRayquaza, tcgdexId: "me06-3", localId: "3", legalExpanded: false };
    const olderNotLegal: ExternalCard = { ...legalOld, tcgdexId: "me05-2", localId: "2", legalStandard: false, regulationMark: null };
    const sameMark: ExternalCard = { ...megaRayquaza, tcgdexId: "me06-4", localId: "4", regulationMark: "J" };
    await persistCatalog(prisma as never, {
      sets: [svSet, newSet],
      cards: [legalOld, rotated, notExpanded, olderNotLegal, sameMark],
    });
    expect(stored(prisma, "me06-2")).toBe(false);
    expect(stored(prisma, "me06-3")).toBe(false);
    expect(stored(prisma, "me05-2")).toBe(false);
    expect(stored(prisma, "me06-4")).toBe(true);
  });

  it("never invents legality when TCGdex classified nothing", async () => {
    const prisma = buildPrismaMock();
    await persistCatalog(prisma as never, { sets: [newSet], cards: [megaRayquaza] });
    expect(stored(prisma, "me06-084")).toBe(false);
  });

  it("a per-set sync uses the stored catalog as reference", async () => {
    const prisma = buildPrismaMock();
    await persistCatalog(prisma as never, { sets: [svSet], cards: [legalOld] });
    await persistCatalog(prisma as never, { sets: [newSet], cards: [megaRayquaza] }, { partial: true });
    expect(stored(prisma, "me06-084")).toBe(true);
  });

  it("re-syncing the new set alone keeps it in Standard", async () => {
    const prisma = buildPrismaMock();
    await persistCatalog(prisma as never, { sets: [svSet, newSet], cards: [legalOld, megaRayquaza] });
    await persistCatalog(prisma as never, { sets: [newSet], cards: [megaRayquaza] }, { partial: true });
    expect(stored(prisma, "me06-084")).toBe(true);
  });

  it("a manual override on the set wins, and the automatic value is kept apart", async () => {
    const prisma = buildPrismaMock();
    await persistCatalog(prisma as never, { sets: [svSet, newSet], cards: [legalOld, megaRayquaza] });
    prisma._sets.get("me06")!.standardOverride = false;
    prisma._sets.get("me05")!.standardOverride = true;
    const notLegalOld: ExternalCard = { ...legalOld, tcgdexId: "me05-9", localId: "9", legalStandard: false };
    await persistCatalog(prisma as never, { sets: [svSet, newSet], cards: [legalOld, megaRayquaza, notLegalOld] });
    expect(prisma._printings.get("me06-084")).toMatchObject({ legalStandard: false, legalStandardAuto: true });
    expect(prisma._printings.get("me05-9")).toMatchObject({ legalStandard: true, legalStandardAuto: false });

    prisma._sets.get("me06")!.standardOverride = null;
    await persistCatalog(prisma as never, { sets: [svSet, newSet], cards: [legalOld, megaRayquaza] });
    expect(prisma._printings.get("me06-084")).toMatchObject({ legalStandard: true, legalStandardAuto: true });
  });
});
