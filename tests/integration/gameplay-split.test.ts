/**
 * Integration: same-name Pokémon split into gameplay versions.
 *   - deck lines on the legacy logical move to the sleeved version, else to
 *     the newest Standard-legal one (merging quantities);
 *   - the 4-copy limit counts every version of a name together.
 * Runs only with RUN_DB_TESTS=1 against a migrated database.
 */
import { config } from "dotenv";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

config();
const RUN = process.env.RUN_DB_TESTS === "1" && Boolean(process.env.DATABASE_URL);

describe.skipIf(!RUN)("integração: versões de jogo de cartas de mesmo nome", async () => {
  const { prisma } = await import("@/server/database");
  const { remapSplitLogicals } = await import("@/server/tcgdex/remap");
  const { validateDecklist } = await import("@/server/services/deck-validator");

  const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const name = `IT Yveltal ${suffix}`;
  const ids = {
    userId: "",
    formatId: "",
    oldSet: "",
    newSet: "",
    legacy: "",
    vOld: "",
    vNew: "",
    deckPlain: "",
    deckMerge: "",
    deckSleeved: "",
    pOld: "",
    pNew: "",
    inventoryItem: "",
  };

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: {
        email: `gs-${suffix}@sleevebuild.test`,
        username: `gs${suffix}`.slice(0, 20),
        passwordHash: "x",
        profile: { create: { displayName: "Gameplay split" } },
      },
    });
    ids.userId = user.id;
    const format = await prisma.format.create({
      data: {
        code: `GS_${suffix}`.toUpperCase(),
        name: `Gameplay split ${suffix}`,
        rules: { create: [{ key: "max_copies", value: { default: 4 } }] },
      },
    });
    ids.formatId = format.id;

    const oldSet = await prisma.cardSet.create({
      data: { tcgdexId: `gs-old-${suffix}`, name: "Old", releaseDate: new Date("2014-02-05") },
    });
    const newSet = await prisma.cardSet.create({
      data: { tcgdexId: `gs-new-${suffix}`, name: "New", releaseDate: new Date("2026-01-30") },
    });
    ids.oldSet = oldSet.id;
    ids.newSet = newSet.id;

    // Before the split: one logical card for every "Yveltal".
    const legacy = await prisma.cardLogical.create({ data: { canonicalName: name, category: "POKEMON" } });
    ids.legacy = legacy.id;
    const pOld = await prisma.cardPrinting.create({
      data: {
        tcgdexId: `gs-old-${suffix}-1`, logicalCardId: legacy.id, setId: oldSet.id, localId: "78",
        name, category: "POKEMON", legalExpanded: true,
      },
    });
    const pNew = await prisma.cardPrinting.create({
      data: {
        tcgdexId: `gs-new-${suffix}-1`, logicalCardId: legacy.id, setId: newSet.id, localId: "88",
        name, category: "POKEMON", legalStandard: true, legalStandardAuto: true, legalExpanded: true,
      },
    });
    ids.pOld = pOld.id;
    ids.pNew = pNew.id;

    const deck = (label: string) =>
      prisma.deck.create({ data: { userId: user.id, formatId: format.id, name: `${label} ${suffix}` } });
    const [plain, merge, sleeved] = await Promise.all([deck("plain"), deck("merge"), deck("sleeved")]);
    ids.deckPlain = plain.id;
    ids.deckMerge = merge.id;
    ids.deckSleeved = sleeved.id;
    await prisma.deckCard.createMany({
      data: [
        { deckId: plain.id, logicalCardId: legacy.id, quantity: 2 },
        { deckId: merge.id, logicalCardId: legacy.id, quantity: 1 },
        { deckId: sleeved.id, logicalCardId: legacy.id, quantity: 2 },
      ],
    });
    // The sleeved deck physically uses the old printing.
    const item = await prisma.inventoryItem.create({
      data: { userId: user.id, cardPrintingId: pOld.id, quantity: 2 },
    });
    ids.inventoryItem = item.id;
    await prisma.deckAllocation.create({ data: { deckId: sleeved.id, inventoryItemId: item.id, quantity: 2 } });

    // What the sync does: one logical per gameplay version, printings move.
    const vOld = await prisma.cardLogical.create({
      data: { canonicalName: name, category: "POKEMON", gameplayKey: "old-version" },
    });
    const vNew = await prisma.cardLogical.create({
      data: { canonicalName: name, category: "POKEMON", gameplayKey: "new-version" },
    });
    ids.vOld = vOld.id;
    ids.vNew = vNew.id;
    await prisma.cardPrinting.update({ where: { id: pOld.id }, data: { logicalCardId: vOld.id } });
    await prisma.cardPrinting.update({ where: { id: pNew.id }, data: { logicalCardId: vNew.id } });
    // A deck that already had the new version added after the split.
    await prisma.deckCard.create({ data: { deckId: merge.id, logicalCardId: vNew.id, quantity: 1 } });
  });

  afterAll(async () => {
    const decks = [ids.deckPlain, ids.deckMerge, ids.deckSleeved].filter(Boolean);
    await prisma.deckAllocation.deleteMany({ where: { deckId: { in: decks } } });
    await prisma.deckCard.deleteMany({ where: { deckId: { in: decks } } });
    await prisma.deck.deleteMany({ where: { id: { in: decks } } });
    await prisma.inventoryItem.deleteMany({ where: { userId: ids.userId } });
    await prisma.cardPrinting.deleteMany({ where: { id: { in: [ids.pOld, ids.pNew].filter(Boolean) } } });
    await prisma.cardLogical.deleteMany({ where: { canonicalName: name } });
    await prisma.cardSet.deleteMany({ where: { id: { in: [ids.oldSet, ids.newSet].filter(Boolean) } } });
    await prisma.formatRule.deleteMany({ where: { formatId: ids.formatId } });
    await prisma.format.deleteMany({ where: { id: ids.formatId } });
    await prisma.userProfile.deleteMany({ where: { userId: ids.userId } });
    await prisma.user.deleteMany({ where: { id: ids.userId } });
  });

  const lines = (deckId: string) =>
    prisma.deckCard.findMany({ where: { deckId }, select: { logicalCardId: true, quantity: true } });

  it("moves deck lines to the sleeved version, else the newest legal one", async () => {
    const stats = await remapSplitLogicals(prisma);
    expect(stats.deckCardsMoved).toBeGreaterThanOrEqual(3);

    expect(await lines(ids.deckPlain)).toEqual([{ logicalCardId: ids.vNew, quantity: 2 }]);
    expect(await lines(ids.deckMerge)).toEqual([{ logicalCardId: ids.vNew, quantity: 2 }]);
    expect(await lines(ids.deckSleeved)).toEqual([{ logicalCardId: ids.vOld, quantity: 2 }]);
    // The legacy row stays (frozen tournament snapshots may mention it).
    expect(await prisma.cardLogical.count({ where: { id: ids.legacy } })).toBe(1);

    const again = await remapSplitLogicals(prisma);
    expect(again.deckCardsMoved).toBe(0);
  });

  it("counts the 4-copy limit across every version of a name", async () => {
    const over = await validateDecklist({
      formatId: ids.formatId,
      cards: [
        { logicalCardId: ids.vOld, quantity: 3 },
        { logicalCardId: ids.vNew, quantity: 2 },
      ],
    });
    expect(over.errors.map((e) => e.code)).toContain("MAX_COPIES_EXCEEDED");
    expect(over.errors.find((e) => e.code === "MAX_COPIES_EXCEEDED")?.message).toContain("atual: 5");

    const ok = await validateDecklist({
      formatId: ids.formatId,
      cards: [
        { logicalCardId: ids.vOld, quantity: 2 },
        { logicalCardId: ids.vNew, quantity: 2 },
      ],
    });
    expect(ok.errors.map((e) => e.code)).not.toContain("MAX_COPIES_EXCEEDED");
  });
});
