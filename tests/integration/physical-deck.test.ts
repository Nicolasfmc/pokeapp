/**
 * Integration tests (§117) contra PostgreSQL real:
 *   Deck ↔ Inventory, Deck ↔ Allocation (sleeve / transfer / unsleeve),
 *   Match ↔ Deck, Match ↔ Archetype, Tournament ↔ Match, exclusão/arquivamento.
 *
 * Rodam só com RUN_DB_TESTS=1 e DATABASE_URL apontando para um banco migrado.
 * Cada execução cria dados com sufixo único e remove tudo no final.
 */
import { config } from "dotenv";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

config();
const RUN = process.env.RUN_DB_TESTS === "1" && Boolean(process.env.DATABASE_URL);

describe.skipIf(!RUN)("integração: deck físico, inventory, training", async () => {
  const { prisma } = await import("@/server/database");
  const { addInventoryStock, adjustInventoryItem } = await import("@/server/services/inventory");
  const { sleeveDeck, unsleeveDeck, AllocationServiceError } = await import(
    "@/server/services/allocation"
  );
  const { transferSleevedDeck } = await import("@/server/services/transfer");
  const { getDeckInventoryCheck } = await import("@/server/services/inventory-check");
  const { getLogicalAvailability } = await import("@/server/services/availability");
  const { createDeck, deleteDeck, replaceCards, importLimitlessDeck } = await import(
    "@/modules/decks/service"
  );
  const { importBattleLog, previewBattleLog, updateMatch, createArchetype } = await import(
    "@/server/services/match"
  );
  const { createTournament, attachMatch, getTournament } = await import(
    "@/server/services/tournament"
  );
  const { getStatisticsSummary } = await import("@/server/services/statistics");
  const { getPublicInventory } = await import("@/modules/profile/service");

  const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const ids = {
    userId: "",
    formatId: "",
    setId: "",
    poffinLogical: "",
    nestLogical: "",
    poffinTef: "",
    poffinPre: "",
    nestSvi: "",
    archetypeNames: [] as string[],
  };

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: {
        email: `it-${suffix}@sleevebuild.test`,
        username: `it${suffix}`.slice(0, 20),
        passwordHash: "x",
        profile: { create: { displayName: "Integration" } },
      },
    });
    ids.userId = user.id;

    const format = await prisma.format.create({
      data: {
        code: `IT_${suffix}`.toUpperCase(),
        name: `Integration ${suffix}`,
        rules: {
          create: [
            { key: "deck_size", value: { min: 1, max: 60 } },
            { key: "max_copies", value: { default: 4 } },
          ],
        },
      },
    });
    ids.formatId = format.id;

    const set = await prisma.cardSet.create({
      data: { tcgdexId: `it-${suffix}`, name: "Integration Set", code: `I${suffix}`.slice(0, 8).toUpperCase() },
    });
    ids.setId = set.id;

    const poffin = await prisma.cardLogical.create({
      data: { canonicalName: `IT Poffin ${suffix}`, category: "TRAINER" },
    });
    const nest = await prisma.cardLogical.create({
      data: { canonicalName: `IT Nest ${suffix}`, category: "TRAINER" },
    });
    ids.poffinLogical = poffin.id;
    ids.nestLogical = nest.id;

    const mk = (localId: string, logicalCardId: string, name: string) =>
      prisma.cardPrinting.create({
        data: {
          tcgdexId: `it-${suffix}-${localId}`,
          logicalCardId,
          setId: set.id,
          localId,
          name,
          category: "TRAINER",
          legalStandard: true,
          legalExpanded: true,
        },
      });
    ids.poffinTef = (await mk("144", poffin.id, poffin.canonicalName)).id;
    ids.poffinPre = (await mk("101", poffin.id, poffin.canonicalName)).id;
    ids.nestSvi = (await mk("002", nest.id, nest.canonicalName)).id;
  });

  afterAll(async () => {
    if (ids.userId) {
      // Ordem respeita FKs Restrict (allocations/matches → deck; transactions → item).
      await prisma.tournament.deleteMany({ where: { userId: ids.userId } });
      await prisma.match.deleteMany({ where: { userId: ids.userId } });
      await prisma.deckAllocation.deleteMany({ where: { deck: { userId: ids.userId } } });
      await prisma.deck.deleteMany({ where: { userId: ids.userId } });
      await prisma.inventoryTransaction.deleteMany({ where: { userId: ids.userId } });
      await prisma.inventoryItem.deleteMany({ where: { userId: ids.userId } });
      await prisma.user.delete({ where: { id: ids.userId } });
    }
    await prisma.archetype.deleteMany({ where: { name: { in: ids.archetypeNames } } });
    await prisma.cardPrinting.deleteMany({ where: { setId: ids.setId } });
    await prisma.cardLogical.deleteMany({
      where: { id: { in: [ids.poffinLogical, ids.nestLogical].filter(Boolean) } },
    });
    if (ids.setId) await prisma.cardSet.delete({ where: { id: ids.setId } });
    if (ids.formatId) await prisma.format.delete({ where: { id: ids.formatId } });
  });

  it("Deck ↔ Inventory: reprints somam na carta lógica e reserva de 4 (§16, §32–34, §57)", async () => {
    await addInventoryStock(ids.userId, { cardPrintingId: ids.poffinTef, quantity: 2 });
    await addInventoryStock(ids.userId, { cardPrintingId: ids.poffinPre, quantity: 3 });
    await addInventoryStock(ids.userId, { cardPrintingId: ids.nestSvi, quantity: 4 });

    const availability = await getLogicalAvailability(ids.userId, ids.poffinLogical);
    expect(availability).toMatchObject({
      ownedQuantity: 5,
      competitiveReserve: 4,
      protectedQuantity: 4,
      availableForTrade: 1,
    });

    // §88–90: perfil público expõe só a quantidade disponível.
    const publicItems = await getPublicInventory(`it${suffix}`.slice(0, 20));
    const poffinPublic = publicItems.find((i) => i.card.id === ids.poffinLogical);
    expect(poffinPublic).toEqual({
      card: expect.objectContaining({ id: ids.poffinLogical, name: `IT Poffin ${suffix}` }),
      availableQuantity: 1,
    });
    expect(publicItems.find((i) => i.card.id === ids.nestLogical)).toBeUndefined();
  });

  it("Deck ↔ Allocation: sleeve, falta, transferência atômica e desmontagem (§29, §45–48)", async () => {
    const deckA = await createDeck(ids.userId, {
      name: "Deck A",
      formatId: ids.formatId,
      cards: [{ logicalCardId: ids.poffinLogical, quantity: 4 }],
    });
    const deckC = await createDeck(ids.userId, {
      name: "Deck C",
      formatId: ids.formatId,
      cards: [
        { logicalCardId: ids.poffinLogical, quantity: 4 },
        { logicalCardId: ids.nestLogical, quantity: 2 },
      ],
    });

    const sleevedA = await sleeveDeck(ids.userId, deckA.id);
    expect(sleevedA.physicalStatus).toBe("SLEEVED");
    expect(sleevedA.allocations.reduce((s, a) => s + a.quantity, 0)).toBe(4);
    // §31: seleção determinística usa as duas impressões (2 + 2 ou 3 + 1).
    expect(new Set(sleevedA.allocations.map((a) => a.cardPrintingId)).size).toBeGreaterThan(0);

    // Sleevado entra na proteção: 5 owned, 4 sleeved → 1 disponível.
    const afterSleeve = await getLogicalAvailability(ids.userId, ids.poffinLogical);
    expect(afterSleeve.sleevedAllocatedQuantity).toBe(4);
    expect(afterSleeve.availableForTrade).toBe(1);

    // §56: C possui tudo, mas 4 Poffin estão presos em A.
    const check = await getDeckInventoryCheck(ids.userId, deckC.id);
    const poffinLine = check.lines.find((l) => l.logicalCardId === ids.poffinLogical)!;
    expect(poffinLine.status).toBe("OWNED");
    expect(poffinLine.freeForDeck).toBe(1);
    expect(poffinLine.physicalShortage).toBe(3);
    expect(check.summary.resolvableByTransfer).toBe(true);
    expect(check.summary.suggestedSourceDecks.map((s) => s.deckId)).toEqual([deckA.id]);

    await expect(sleeveDeck(ids.userId, deckC.id)).rejects.toBeInstanceOf(
      AllocationServiceError,
    );

    // §47: transferir de A para C → A vira NOT_SLEEVED, C SLEEVED.
    const transfer = await transferSleevedDeck(ids.userId, deckC.id, deckA.id);
    expect(transfer.targetPhysicalStatus).toBe("SLEEVED");
    const [a, c] = await Promise.all([
      prisma.deck.findUniqueOrThrow({ where: { id: deckA.id } }),
      prisma.deck.findUniqueOrThrow({ where: { id: deckC.id } }),
    ]);
    expect(a.physicalStatus).toBe("NOT_SLEEVED");
    expect(c.physicalStatus).toBe("SLEEVED");
    expect(await prisma.deckAllocation.count({ where: { deckId: deckA.id } })).toBe(0);

    // §113: soma alocada = quantidade exigida para cada carta.
    const allocs = await prisma.deckAllocation.findMany({
      where: { deckId: deckC.id },
      include: { inventoryItem: { include: { cardPrinting: true } } },
    });
    const byLogical = new Map<string, number>();
    for (const row of allocs) {
      const key = row.inventoryItem.cardPrinting.logicalCardId;
      byLogical.set(key, (byLogical.get(key) ?? 0) + row.quantity);
    }
    expect(byLogical.get(ids.poffinLogical)).toBe(4);
    expect(byLogical.get(ids.nestLogical)).toBe(2);

    // §111: não dá para reduzir o estoque abaixo do alocado.
    const tefItem = await prisma.inventoryItem.findFirstOrThrow({
      where: { userId: ids.userId, cardPrintingId: ids.poffinTef },
      include: { allocations: true },
    });
    const allocatedTef = tefItem.allocations.reduce((s, r) => s + r.quantity, 0);
    if (allocatedTef > 0) {
      await expect(
        adjustInventoryItem(ids.userId, tefItem.id, {
          quantityDelta: -(tefItem.quantity - allocatedTef + 1),
          reason: "SALE",
        }),
      ).rejects.toMatchObject({ code: "BELOW_ALLOCATED" });
    }

    // §49: editar deck Sleevado para exigir mais do que existe → deixa de ser SLEEVED.
    await replaceCards(ids.userId, deckC.id, [
      { logicalCardId: ids.poffinLogical, quantity: 4 },
      { logicalCardId: ids.nestLogical, quantity: 4 },
    ]);
    expect(
      (await prisma.deck.findUniqueOrThrow({ where: { id: deckC.id } })).physicalStatus,
    ).toBe("SLEEVED");
    await replaceCards(ids.userId, deckC.id, [
      { logicalCardId: ids.poffinLogical, quantity: 4 },
      { logicalCardId: ids.nestLogical, quantity: 5 },
    ]);
    expect(
      (await prisma.deck.findUniqueOrThrow({ where: { id: deckC.id } })).physicalStatus,
    ).toBe("NOT_SLEEVED");

    // §43: desmontar libera tudo.
    await sleeveDeck(ids.userId, deckA.id);
    await unsleeveDeck(ids.userId, deckA.id);
    expect(await prisma.deckAllocation.count({ where: { deck: { userId: ids.userId } } })).toBe(0);
  });

  it("importação Limitless resolve set+número com zero à esquerda e marca não resolvidas (§50–54)", async () => {
    const set = await prisma.cardSet.findUniqueOrThrow({ where: { id: ids.setId } });
    const result = await importLimitlessDeck(ids.userId, {
      name: "Import IT",
      formatId: ids.formatId,
      decklist: [
        "Trainer: 6",
        `4 IT Poffin ${suffix} ${set.code} 144`,
        `2 IT Nest ${suffix} ${set.code} 2`,
        "1 Carta Inexistente ZZZ 999",
      ].join("\n"),
    });
    expect(result.resolvedCount).toBe(6);
    expect(result.unresolvedCount).toBe(1);
    expect(result.deck.importStatus).toBe("PARTIALLY_RESOLVED");
    expect(result.unresolved[0]).toMatchObject({ setCode: "ZZZ", collectorNumber: "999" });
    expect(result.inventoryCheck.lines).toHaveLength(2);
  });

  it("Match ↔ Deck ↔ Archetype ↔ Tournament e estatísticas (§61–79)", async () => {
    const deck = await createDeck(ids.userId, { name: "Deck Match", formatId: ids.formatId });
    const archetypeName = `IT Dragapult ${suffix}`;
    ids.archetypeNames.push(archetypeName);
    const archetype = await createArchetype({ name: archetypeName, displayPokemon: ["Dreepy"] });
    expect(archetype.displayPokemon).toEqual(["Dreepy"]);

    const rawLog = [
      "Ayesai vs nicolasfmc",
      "Format: TEF-PBL",
      "Ayesai will go first.",
      "Ayesai played (twm_128) Dreepy to the Bench.",
      "Ayesai wins.",
    ].join("\n");

    const preview = await previewBattleLog({ rawLog, viewerName: "nicolasfmc" });
    expect(preview.opponentPokemon).toEqual(["Dreepy"]);
    expect(preview.suggestedArchetype?.archetypeId).toBe(archetype.id);

    const imported = await importBattleLog(ids.userId, {
      rawLog,
      deckId: deck.id,
      viewerName: "nicolasfmc",
      opponentArchetypeId: archetype.id,
    });
    expect(imported.match).toMatchObject({
      result: "LOSS",
      turnOrder: "SECOND",
      gameFormatCode: "TEF-PBL",
      opponentArchetypeId: archetype.id,
    });
    const battleLog = await prisma.battleLog.findUniqueOrThrow({
      where: { id: imported.match.battleLogId! },
    });
    expect(battleLog.rawLog).toBe(rawLog);
    expect(battleLog.parserVersion).toBe("1.1.0");

    // §71: edição posterior não toca o raw log.
    await updateMatch(ids.userId, imported.match.id, { notes: "editado", result: "WIN" });
    expect(
      (await prisma.battleLog.findUniqueOrThrow({ where: { id: battleLog.id } })).rawLog,
    ).toBe(rawLog);

    const tournament = await createTournament(ids.userId, {
      name: "IT Cup",
      placement: 3,
      participantCount: 24,
    });
    await attachMatch(ids.userId, tournament.id, { matchId: imported.match.id, round: 2 });
    const detail = await getTournament(ids.userId, tournament.id);
    expect(detail.placement).toBe(3);
    expect(detail.tournamentMatches).toHaveLength(1);
    expect(detail.tournamentMatches[0].round).toBe(2);

    const stats = await getStatisticsSummary(ids.userId, { tournamentId: tournament.id });
    expect(stats.overall).toMatchObject({ matches: 1, wins: 1, losses: 0, winRate: 1 });

    // §114: deck com partidas é arquivado, não apagado.
    const removal = await deleteDeck(ids.userId, deck.id);
    expect(removal.archived).toBe(true);
    const tags = await prisma.deckTag.findMany({ where: { deckId: deck.id } });
    expect(tags.map((t) => t.tag)).toContain("ARCHIVED");
  });
});
