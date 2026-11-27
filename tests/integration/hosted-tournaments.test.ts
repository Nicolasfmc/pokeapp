/**
 * Hosted tournaments end to end against real PostgreSQL: registration, Swiss
 * rounds, reports, judge decisions, timer timeout, drops and hidden lists.
 * Runs only with RUN_DB_TESTS=1.
 */
import { config } from "dotenv";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

config();
const RUN = process.env.RUN_DB_TESTS === "1" && Boolean(process.env.DATABASE_URL);

describe.skipIf(!RUN)("integração: torneios organizados", async () => {
  const { prisma } = await import("@/server/database");
  const svc = await import("@/server/services/hosted-tournament/service");

  const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const users: Array<{ id: string; username: string }> = [];
  let organizer: { id: string; username: string };
  let formatId: string;
  let logicalCardId: string;

  async function makeUser(tag: string) {
    const user = await prisma.user.create({
      data: {
        email: `ht-${tag}-${suffix}@sleevebuild.test`,
        username: `h${tag}${suffix}`.slice(0, 20),
        passwordHash: "x",
      },
      select: { id: true, username: true },
    });
    users.push(user);
    return user;
  }

  async function view(code: string, userId: string | null) {
    return svc.getHostedTournamentView(code, userId);
  }

  function currentPairings(v: Awaited<ReturnType<typeof view>>) {
    return v.rounds.find((r) => r.number === v.tournament.currentRound)!.pairings;
  }

  function userOfEntry(v: Awaited<ReturnType<typeof view>>, entryId: string) {
    const username = v.players.find((p) => p.entryId === entryId)!.username;
    return users.find((u) => u.username === username)!;
  }

  beforeAll(async () => {
    const format = await prisma.format.findFirstOrThrow({ where: { code: "STANDARD" } });
    formatId = format.id;
    organizer = await makeUser("org");
    const card = await prisma.cardLogical.create({
      data: { canonicalName: `Test Card ${suffix}`, category: "POKEMON" },
    });
    logicalCardId = card.id;
  });

  afterAll(async () => {
    await prisma.hostedTournament.deleteMany({ where: { organizerId: organizer.id } });
    await prisma.deck.deleteMany({ where: { userId: { in: users.map((u) => u.id) } } });
    await prisma.user.deleteMany({ where: { id: { in: users.map((u) => u.id) } } });
    await prisma.cardLogical.deleteMany({ where: { id: logicalCardId } });
    await prisma.authRateLimit.deleteMany({
      where: { OR: users.map((u) => ({ key: { contains: u.id } })) },
    });
  });

  it("validates settings", async () => {
    await expect(
      svc.createHostedTournament(organizer.id, {
        name: "x",
        locationType: "ONLINE",
        formatId,
        bestOf: 3,
        deckPolicy: "OPTIONAL",
      }),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      svc.createHostedTournament(organizer.id, {
        name: "Liga",
        locationType: "IN_PERSON",
        location: "",
        formatId,
        bestOf: 3,
        deckPolicy: "OPTIONAL",
      }),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      svc.createHostedTournament(organizer.id, {
        name: "Liga",
        locationType: "ONLINE",
        formatId,
        bestOf: 2,
        deckPolicy: "OPTIONAL",
      }),
    ).rejects.toMatchObject({ status: 400 });
    expect(svc.isValidTournamentCode("'; DROP TABLE users; --")).toBe(false);
    await expect(view("'; DROP TABLE users;--", null)).rejects.toMatchObject({ status: 404 });
  });

  it("runs a full Swiss tournament with 5 players", async () => {
    const { code } = await svc.createHostedTournament(organizer.id, {
      name: `Liga ${suffix}`,
      locationType: "ONLINE",
      formatId,
      bestOf: 3,
      deckPolicy: "OPTIONAL",
    });
    expect(code).toMatch(/^[A-Za-z0-9]{10}$/);

    const players = [];
    for (let i = 0; i < 4; i += 1) players.push(await makeUser(`p${i}`));
    for (const p of players) await svc.joinHostedTournament(p.id, code, null);
    // The organizer plays too (judge badge).
    await svc.joinHostedTournament(organizer.id, code, null);
    await expect(svc.joinHostedTournament(players[0].id, code, null)).rejects.toMatchObject({
      code: "ALREADY_JOINED",
    });

    // Only the organizer starts.
    await expect(svc.startHostedTournament(players[0].id, code)).rejects.toMatchObject({ status: 403 });
    await svc.startHostedTournament(organizer.id, code);

    let v = await view(code, organizer.id);
    expect(v.tournament.status).toBe("IN_PROGRESS");
    expect(v.tournament.plannedRounds).toBe(3);
    expect(v.players.find((p) => p.username === organizer.username)?.isJudge).toBe(true);
    let pairings = currentPairings(v);
    expect(pairings.filter((p) => p.player2 === null)).toHaveLength(1);
    expect(pairings.filter((p) => p.player2 !== null).map((p) => p.tableNumber)).toEqual([1, 2]);

    // Can't join or advance yet.
    const late = await makeUser("late");
    await expect(svc.joinHostedTournament(late.id, code, null)).rejects.toMatchObject({ status: 409 });
    await expect(svc.startNextRound(organizer.id, code)).rejects.toMatchObject({ code: "ROUND_OPEN" });

    // Table 1: report 2-1 and the opponent confirms.
    const [t1, t2] = pairings.filter((p) => p.player2 !== null);
    const a = userOfEntry(v, t1.player1.entryId);
    const b = userOfEntry(v, t1.player2!.entryId);
    await expect(
      svc.reportResult(a.id, code, t1.id, { myGames: 3, opponentGames: 0, drawGames: 0 }),
    ).rejects.toMatchObject({ code: "INVALID_SCORE" });
    await svc.reportResult(a.id, code, t1.id, { myGames: 2, opponentGames: 1, drawGames: 0 });
    v = await view(code, b.id);
    const pending = currentPairings(v).find((p) => p.id === t1.id)!;
    expect(pending.status).toBe("AWAITING_CONFIRMATION");
    expect(pending.canConfirm).toBe(true);
    await expect(svc.respondToReport(a.id, code, t1.id, true)).rejects.toMatchObject({
      code: "NOTHING_TO_CONFIRM",
    });
    await svc.respondToReport(b.id, code, t1.id, true);

    // A stranger can't report someone else's match.
    await expect(
      svc.reportResult(late.id, code, t2.id, { myGames: 2, opponentGames: 0, drawGames: 0 }),
    ).rejects.toMatchObject({ code: "NOT_YOUR_MATCH" });

    // Table 2: conflicting reports → dispute → judge decides.
    const c = userOfEntry(v, t2.player1.entryId);
    const d = userOfEntry(v, t2.player2!.entryId);
    await svc.reportResult(c.id, code, t2.id, { myGames: 2, opponentGames: 0, drawGames: 0 });
    await svc.reportResult(d.id, code, t2.id, { myGames: 2, opponentGames: 0, drawGames: 0 });
    v = await view(code, organizer.id);
    expect(currentPairings(v).find((p) => p.id === t2.id)!.status).toBe("DISPUTED");
    await expect(
      svc.judgeResult(late.id, code, t2.id, {
        player1Games: 2,
        player2Games: 0,
        drawGames: 0,
      }),
    ).rejects.toMatchObject({ status: 403 });
    await svc.judgeResult(organizer.id, code, t2.id, { player1Games: 0, player2Games: 2, drawGames: 0 });

    v = await view(code, organizer.id);
    pairings = currentPairings(v);
    expect(pairings.every((p) => p.status === "CONFIRMED" || p.status === "BYE")).toBe(true);
    const byeR1 = pairings.find((p) => p.player2 === null)!.player1.entryId;
    expect(v.standings.find((s) => s.entryId === byeR1)!.points).toBe(3);

    // Round 2: no rematch, a different bye, records shown entering the round.
    await svc.startNextRound(organizer.id, code);
    v = await view(code, organizer.id);
    expect(v.tournament.currentRound).toBe(2);
    const r1Keys = new Set(
      v.rounds[0].pairings
        .filter((p) => p.player2)
        .map((p) => [p.player1.entryId, p.player2!.entryId].sort().join("|")),
    );
    pairings = currentPairings(v);
    for (const p of pairings.filter((x) => x.player2)) {
      expect(r1Keys.has([p.player1.entryId, p.player2!.entryId].sort().join("|"))).toBe(false);
      const sum = (r: { wins: number; losses: number; draws: number }) => r.wins + r.losses + r.draws;
      expect(sum(p.player1.record)).toBe(1);
    }
    expect(pairings.find((p) => p.player2 === null)!.player1.entryId).not.toBe(byeR1);

    // Timer runs out: unreported → draw; reported but unconfirmed → dispute.
    const [r2t1, r2t2] = pairings.filter((p) => p.player2 !== null);
    const reporter = userOfEntry(v, r2t1.player1.entryId);
    await svc.reportResult(reporter.id, code, r2t1.id, { myGames: 2, opponentGames: 0, drawGames: 0 });
    const tournamentId = (await prisma.hostedTournament.findUniqueOrThrow({ where: { code } })).id;
    await prisma.hostedTournamentRound.update({
      where: { tournamentId_number: { tournamentId, number: 2 } },
      // 50-minute round that started 60 minutes ago.
      data: { startedAt: new Date(Date.now() - 60 * 60 * 1000) },
    });
    v = await view(code, null);
    expect(v.rounds[1].timer.expired).toBe(true);
    pairings = currentPairings(v);
    expect(pairings.find((p) => p.id === r2t1.id)!.status).toBe("DISPUTED");
    const timed = pairings.find((p) => p.id === r2t2.id)!;
    expect(timed).toMatchObject({ status: "CONFIRMED", result: "DRAW", source: "TIMER" });

    // Adding time after it ran out reopens the automatic draws.
    await svc.controlTimer(organizer.id, code, "add", 30);
    v = await view(code, null);
    expect(currentPairings(v).find((p) => p.id === r2t2.id)!.status).toBe("PENDING");
    expect(v.rounds[1].timer.expired).toBe(false);
    await svc.controlTimer(organizer.id, code, "pause", undefined);
    v = await view(code, null);
    expect(v.rounds[1].timer.paused).toBe(true);
    await svc.controlTimer(organizer.id, code, "resume", undefined);

    await svc.judgeResult(organizer.id, code, r2t1.id, { player1Games: 2, player2Games: 0, drawGames: 0 });
    await svc.judgeResult(organizer.id, code, r2t2.id, { player1Games: 1, player2Games: 1, drawGames: 0 });

    // A player drops: not paired anymore, results kept. 4 active → no bye.
    const dropper = userOfEntry(v, r2t2.player1.entryId);
    await svc.leaveHostedTournament(dropper.id, code);
    await svc.startNextRound(organizer.id, code);
    v = await view(code, organizer.id);
    pairings = currentPairings(v);
    const paired = pairings.flatMap((p) => [p.player1.entryId, p.player2?.entryId]);
    expect(paired).not.toContain(r2t2.player1.entryId);
    expect(pairings.some((p) => p.player2 === null)).toBe(false);
    expect(v.players.find((p) => p.entryId === r2t2.player1.entryId)!.dropped).toBe(true);

    // Last round: can't go beyond the planned rounds, then finish.
    for (const p of pairings) {
      await svc.judgeResult(organizer.id, code, p.id, { player1Games: 2, player2Games: 1, drawGames: 0 });
    }
    await expect(svc.startNextRound(organizer.id, code)).rejects.toMatchObject({ code: "LAST_ROUND" });
    await svc.finishHostedTournament(organizer.id, code);
    v = await view(code, null);
    expect(v.tournament.status).toBe("FINISHED");
    expect(v.standings.map((s) => s.rank)).toEqual([1, 2, 3, 4, 5]);
    expect(v.standings[0].points).toBeGreaterThanOrEqual(v.standings[4].points);
    expect(v.viewer.signedIn).toBe(false);
  });

  it("requires a deck of the format, freezes it at the start and never exposes it", async () => {
    const { code } = await svc.createHostedTournament(organizer.id, {
      name: `Copa ${suffix}`,
      locationType: "IN_PERSON",
      location: "Loja Centro",
      formatId,
      bestOf: 1,
      deckPolicy: "REQUIRED",
      maxPlayers: 2,
    });
    const [x, y, z] = [await makeUser("x"), await makeUser("y"), await makeUser("z")];
    const secretName = `Segredo ${suffix}`;
    const deckX = await prisma.deck.create({
      data: {
        userId: x.id,
        name: secretName,
        formatId,
        cards: { create: [{ logicalCardId, quantity: 4 }] },
      },
    });
    const deckY = await prisma.deck.create({
      data: { userId: y.id, name: `Y ${suffix}`, formatId, cards: { create: [{ logicalCardId, quantity: 4 }] } },
    });
    const otherFormat = await prisma.format.findFirstOrThrow({ where: { code: "EXPANDED" } });
    const wrongFormat = await prisma.deck.create({
      data: { userId: y.id, name: "Expanded", formatId: otherFormat.id, cards: { create: [{ logicalCardId, quantity: 1 }] } },
    });

    await expect(svc.joinHostedTournament(x.id, code, null)).rejects.toMatchObject({ code: "DECK_REQUIRED" });
    await expect(svc.joinHostedTournament(x.id, code, deckY.id)).rejects.toMatchObject({ code: "DECK_NOT_FOUND" });
    await expect(svc.joinHostedTournament(y.id, code, wrongFormat.id)).rejects.toMatchObject({ code: "DECK_FORMAT" });
    await svc.joinHostedTournament(x.id, code, deckX.id);
    await svc.joinHostedTournament(y.id, code, deckY.id);
    await expect(svc.joinHostedTournament(z.id, code, null)).rejects.toMatchObject({ code: "FULL" });

    // Own deck is visible to its owner before the start, never to others.
    expect((await view(code, x.id)).viewer.deck?.name).toBe(secretName);
    expect(JSON.stringify(await view(code, y.id))).not.toContain(secretName);
    expect(JSON.stringify(await view(code, null))).not.toContain(secretName);

    await svc.startHostedTournament(organizer.id, code);
    const snapshot = await prisma.hostedDeckSnapshot.findFirstOrThrow({
      where: { entry: { userId: x.id, tournament: { code } } },
    });
    expect(snapshot.deckName).toBe(secretName);
    expect(snapshot.cardCount).toBe(4);

    // Editing the original deck after the start doesn't touch the frozen copy.
    await prisma.deck.update({ where: { id: deckX.id }, data: { name: "Renomeado" } });
    await prisma.deckCard.updateMany({ where: { deckId: deckX.id }, data: { quantity: 2 } });
    const frozen = await prisma.hostedDeckSnapshot.findUniqueOrThrow({ where: { id: snapshot.id } });
    expect(frozen.deckName).toBe(secretName);
    expect(frozen.cardCount).toBe(4);

    // During the tournament nobody (not even the owner) gets the list.
    expect(JSON.stringify(await view(code, x.id))).not.toContain(secretName);
    expect(JSON.stringify(await view(code, organizer.id))).not.toContain(secretName);

    // Settings that change the rules are locked after the start.
    await expect(svc.updateHostedTournament(organizer.id, code, { bestOf: 3 })).rejects.toMatchObject({
      status: 409,
    });
    await svc.updateHostedTournament(organizer.id, code, { name: `Copa renomeada ${suffix}` });
  });

  it("serializes concurrent next-round clicks", async () => {
    const { code } = await svc.createHostedTournament(organizer.id, {
      name: `Rápido ${suffix}`,
      locationType: "ONLINE",
      formatId,
      bestOf: 1,
      deckPolicy: "OPTIONAL",
      plannedRounds: 3,
    });
    const ps = [await makeUser("c1"), await makeUser("c2"), await makeUser("c3"), await makeUser("c4")];
    for (const p of ps) await svc.joinHostedTournament(p.id, code, null);
    await svc.startHostedTournament(organizer.id, code);
    const v = await view(code, organizer.id);
    for (const p of currentPairings(v)) {
      await svc.judgeResult(organizer.id, code, p.id, { player1Games: 1, player2Games: 0, drawGames: 0 });
    }
    const results = await Promise.allSettled([
      svc.startNextRound(organizer.id, code),
      svc.startNextRound(organizer.id, code),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const after = await view(code, null);
    expect(after.rounds).toHaveLength(2);
  });
});
