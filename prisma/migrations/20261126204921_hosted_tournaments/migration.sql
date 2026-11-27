-- CreateEnum
CREATE TYPE "HostedTournamentStatus" AS ENUM ('REGISTRATION', 'IN_PROGRESS', 'FINISHED');

-- CreateEnum
CREATE TYPE "HostedLocationType" AS ENUM ('IN_PERSON', 'ONLINE');

-- CreateEnum
CREATE TYPE "HostedDeckPolicy" AS ENUM ('REQUIRED', 'OPTIONAL');

-- CreateEnum
CREATE TYPE "HostedEntryStatus" AS ENUM ('ACTIVE', 'DROPPED');

-- CreateEnum
CREATE TYPE "HostedRoundStatus" AS ENUM ('IN_PROGRESS', 'FINISHED');

-- CreateEnum
CREATE TYPE "HostedPairingStatus" AS ENUM ('PENDING', 'AWAITING_CONFIRMATION', 'CONFIRMED', 'DISPUTED', 'BYE');

-- CreateEnum
CREATE TYPE "HostedPairingResult" AS ENUM ('PLAYER1_WIN', 'PLAYER2_WIN', 'DRAW');

-- CreateEnum
CREATE TYPE "HostedResultSource" AS ENUM ('PLAYERS', 'TIMER', 'JUDGE', 'BYE');

-- CreateTable
CREATE TABLE "hosted_tournaments" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "organizerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "date" TIMESTAMP(3),
    "locationType" "HostedLocationType" NOT NULL,
    "location" TEXT,
    "formatId" TEXT NOT NULL,
    "bestOf" INTEGER NOT NULL,
    "pointsWin" INTEGER NOT NULL DEFAULT 3,
    "pointsDraw" INTEGER NOT NULL DEFAULT 1,
    "pointsLoss" INTEGER NOT NULL DEFAULT 0,
    "deckPolicy" "HostedDeckPolicy" NOT NULL,
    "plannedRounds" INTEGER,
    "roundMinutes" INTEGER NOT NULL,
    "maxPlayers" INTEGER,
    "status" "HostedTournamentStatus" NOT NULL DEFAULT 'REGISTRATION',
    "currentRound" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hosted_tournaments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hosted_tournament_entries" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "deckId" TEXT,
    "status" "HostedEntryStatus" NOT NULL DEFAULT 'ACTIVE',
    "droppedAfterRound" INTEGER,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hosted_tournament_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hosted_deck_snapshots" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "deckName" TEXT NOT NULL,
    "archetypeId" TEXT,
    "archetypeName" TEXT,
    "displayPokemon" JSONB,
    "coverImageUrl" TEXT,
    "cards" JSONB NOT NULL,
    "cardCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hosted_deck_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hosted_tournament_rounds" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "status" "HostedRoundStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "durationSeconds" INTEGER NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "pausedAt" TIMESTAMP(3),
    "pausedSeconds" INTEGER NOT NULL DEFAULT 0,
    "timeoutAppliedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "hosted_tournament_rounds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hosted_pairings" (
    "id" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "tableNumber" INTEGER,
    "player1Id" TEXT NOT NULL,
    "player2Id" TEXT,
    "status" "HostedPairingStatus" NOT NULL DEFAULT 'PENDING',
    "result" "HostedPairingResult",
    "player1Games" INTEGER NOT NULL DEFAULT 0,
    "player2Games" INTEGER NOT NULL DEFAULT 0,
    "drawGames" INTEGER NOT NULL DEFAULT 0,
    "source" "HostedResultSource",
    "reportedByEntryId" TEXT,
    "reportedAt" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hosted_pairings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "hosted_tournaments_code_key" ON "hosted_tournaments"("code");

-- CreateIndex
CREATE INDEX "hosted_tournaments_organizerId_idx" ON "hosted_tournaments"("organizerId");

-- CreateIndex
CREATE INDEX "hosted_tournaments_status_idx" ON "hosted_tournaments"("status");

-- CreateIndex
CREATE INDEX "hosted_tournament_entries_userId_idx" ON "hosted_tournament_entries"("userId");

-- CreateIndex
CREATE INDEX "hosted_tournament_entries_deckId_idx" ON "hosted_tournament_entries"("deckId");

-- CreateIndex
CREATE UNIQUE INDEX "hosted_tournament_entries_tournamentId_userId_key" ON "hosted_tournament_entries"("tournamentId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "hosted_deck_snapshots_entryId_key" ON "hosted_deck_snapshots"("entryId");

-- CreateIndex
CREATE UNIQUE INDEX "hosted_tournament_rounds_tournamentId_number_key" ON "hosted_tournament_rounds"("tournamentId", "number");

-- CreateIndex
CREATE INDEX "hosted_pairings_roundId_idx" ON "hosted_pairings"("roundId");

-- CreateIndex
CREATE INDEX "hosted_pairings_player1Id_idx" ON "hosted_pairings"("player1Id");

-- CreateIndex
CREATE INDEX "hosted_pairings_player2Id_idx" ON "hosted_pairings"("player2Id");

-- AddForeignKey
ALTER TABLE "hosted_tournaments" ADD CONSTRAINT "hosted_tournaments_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hosted_tournaments" ADD CONSTRAINT "hosted_tournaments_formatId_fkey" FOREIGN KEY ("formatId") REFERENCES "formats"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hosted_tournament_entries" ADD CONSTRAINT "hosted_tournament_entries_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "hosted_tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hosted_tournament_entries" ADD CONSTRAINT "hosted_tournament_entries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hosted_tournament_entries" ADD CONSTRAINT "hosted_tournament_entries_deckId_fkey" FOREIGN KEY ("deckId") REFERENCES "decks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hosted_deck_snapshots" ADD CONSTRAINT "hosted_deck_snapshots_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "hosted_tournament_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hosted_tournament_rounds" ADD CONSTRAINT "hosted_tournament_rounds_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "hosted_tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hosted_pairings" ADD CONSTRAINT "hosted_pairings_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "hosted_tournament_rounds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hosted_pairings" ADD CONSTRAINT "hosted_pairings_player1Id_fkey" FOREIGN KEY ("player1Id") REFERENCES "hosted_tournament_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hosted_pairings" ADD CONSTRAINT "hosted_pairings_player2Id_fkey" FOREIGN KEY ("player2Id") REFERENCES "hosted_tournament_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
