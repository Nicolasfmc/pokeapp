-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('ACTIVE', 'DELETION_PENDING', 'PERMANENTLY_DELETED');

-- CreateEnum
CREATE TYPE "CardCategory" AS ENUM ('POKEMON', 'TRAINER', 'ENERGY');

-- CreateEnum
CREATE TYPE "PhysicalStatus" AS ENUM ('SLEEVED', 'NOT_SLEEVED');

-- CreateEnum
CREATE TYPE "DeckImportStatus" AS ENUM ('IMPORTED', 'PARTIALLY_RESOLVED', 'READY', 'INVALID');

-- CreateEnum
CREATE TYPE "DeckTagName" AS ENUM ('FAVORITE', 'TESTING', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "Condition" AS ENUM ('NM', 'LP', 'MP', 'HP', 'DMG');

-- CreateEnum
CREATE TYPE "CollectionStatus" AS ENUM ('COMPETITIVE', 'COLLECTION');

-- CreateEnum
CREATE TYPE "InventoryTransactionReason" AS ENUM ('PURCHASE', 'SALE', 'TRADE', 'GIFT', 'LOST', 'DAMAGED', 'CORRECTION', 'OTHER');

-- CreateEnum
CREATE TYPE "MatchResult" AS ENUM ('WIN', 'LOSS', 'DRAW', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "TurnOrder" AS ENUM ('FIRST', 'SECOND');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "accountStatus" "AccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "usernameChangedAt" TIMESTAMP(3),
    "deletionRequestedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "bio" TEXT,
    "avatarUrl" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "card_sets" (
    "id" TEXT NOT NULL,
    "tcgdexId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "series" TEXT,
    "releaseDate" TIMESTAMP(3),
    "logoUrl" TEXT,
    "symbolUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "card_sets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "card_logicals" (
    "id" TEXT NOT NULL,
    "canonicalName" TEXT NOT NULL,
    "category" "CardCategory" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "card_logicals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "card_printings" (
    "id" TEXT NOT NULL,
    "tcgdexId" TEXT NOT NULL,
    "logicalCardId" TEXT NOT NULL,
    "setId" TEXT NOT NULL,
    "localId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "CardCategory" NOT NULL,
    "rarity" TEXT,
    "illustrator" TEXT,
    "regulationMark" TEXT,
    "legalStandard" BOOLEAN NOT NULL DEFAULT false,
    "legalExpanded" BOOLEAN NOT NULL DEFAULT false,
    "imageUrl" TEXT,
    "tcgdexUpdatedAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "card_printings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "formats" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "formats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "format_rules" (
    "id" TEXT NOT NULL,
    "formatId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "format_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "archetypes" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "displayPokemon" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "archetypes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "decks" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "formatId" TEXT NOT NULL,
    "archetypeId" TEXT,
    "description" TEXT,
    "physicalStatus" "PhysicalStatus" NOT NULL DEFAULT 'NOT_SLEEVED',
    "importStatus" "DeckImportStatus",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "decks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deck_cards" (
    "id" TEXT NOT NULL,
    "deckId" TEXT NOT NULL,
    "logicalCardId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "deck_cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deck_tags" (
    "id" TEXT NOT NULL,
    "deckId" TEXT NOT NULL,
    "tag" "DeckTagName" NOT NULL,

    CONSTRAINT "deck_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_items" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cardPrintingId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "condition" "Condition" NOT NULL DEFAULT 'NM',
    "language" TEXT NOT NULL DEFAULT 'en',
    "collectionStatus" "CollectionStatus" NOT NULL DEFAULT 'COMPETITIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deck_allocations" (
    "id" TEXT NOT NULL,
    "deckId" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deck_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_transactions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "quantityDelta" INTEGER NOT NULL,
    "reason" "InventoryTransactionReason" NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "battle_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rawLog" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "parserVersion" TEXT NOT NULL,

    CONSTRAINT "battle_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "matches" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "battleLogId" TEXT,
    "deckId" TEXT NOT NULL,
    "opponentArchetypeId" TEXT,
    "result" "MatchResult" NOT NULL,
    "turnOrder" "TurnOrder",
    "gameFormatCode" TEXT,
    "formatId" TEXT,
    "notes" TEXT,
    "playedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "matches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tournaments" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "date" TIMESTAMP(3),
    "location" TEXT,
    "formatId" TEXT,
    "placement" INTEGER,
    "participantCount" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tournaments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tournament_matches" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "round" INTEGER,

    CONSTRAINT "tournament_matches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE INDEX "users_username_idx" ON "users"("username");

-- CreateIndex
CREATE INDEX "users_accountStatus_idx" ON "users"("accountStatus");

-- CreateIndex
CREATE UNIQUE INDEX "user_profiles_userId_key" ON "user_profiles"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "card_sets_tcgdexId_key" ON "card_sets"("tcgdexId");

-- CreateIndex
CREATE INDEX "card_sets_code_idx" ON "card_sets"("code");

-- CreateIndex
CREATE INDEX "card_sets_name_idx" ON "card_sets"("name");

-- CreateIndex
CREATE INDEX "card_logicals_canonicalName_idx" ON "card_logicals"("canonicalName");

-- CreateIndex
CREATE INDEX "card_logicals_category_idx" ON "card_logicals"("category");

-- CreateIndex
CREATE UNIQUE INDEX "card_printings_tcgdexId_key" ON "card_printings"("tcgdexId");

-- CreateIndex
CREATE INDEX "card_printings_tcgdexId_idx" ON "card_printings"("tcgdexId");

-- CreateIndex
CREATE INDEX "card_printings_setId_idx" ON "card_printings"("setId");

-- CreateIndex
CREATE INDEX "card_printings_localId_idx" ON "card_printings"("localId");

-- CreateIndex
CREATE INDEX "card_printings_logicalCardId_idx" ON "card_printings"("logicalCardId");

-- CreateIndex
CREATE INDEX "card_printings_name_idx" ON "card_printings"("name");

-- CreateIndex
CREATE INDEX "card_printings_category_idx" ON "card_printings"("category");

-- CreateIndex
CREATE INDEX "card_printings_regulationMark_idx" ON "card_printings"("regulationMark");

-- CreateIndex
CREATE INDEX "card_printings_legalStandard_idx" ON "card_printings"("legalStandard");

-- CreateIndex
CREATE INDEX "card_printings_legalExpanded_idx" ON "card_printings"("legalExpanded");

-- CreateIndex
CREATE UNIQUE INDEX "card_printings_setId_localId_key" ON "card_printings"("setId", "localId");

-- CreateIndex
CREATE UNIQUE INDEX "formats_code_key" ON "formats"("code");

-- CreateIndex
CREATE INDEX "format_rules_formatId_idx" ON "format_rules"("formatId");

-- CreateIndex
CREATE UNIQUE INDEX "format_rules_formatId_key_key" ON "format_rules"("formatId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "archetypes_name_key" ON "archetypes"("name");

-- CreateIndex
CREATE INDEX "archetypes_name_idx" ON "archetypes"("name");

-- CreateIndex
CREATE INDEX "decks_userId_idx" ON "decks"("userId");

-- CreateIndex
CREATE INDEX "decks_formatId_idx" ON "decks"("formatId");

-- CreateIndex
CREATE INDEX "decks_archetypeId_idx" ON "decks"("archetypeId");

-- CreateIndex
CREATE INDEX "decks_physicalStatus_idx" ON "decks"("physicalStatus");

-- CreateIndex
CREATE INDEX "deck_cards_deckId_idx" ON "deck_cards"("deckId");

-- CreateIndex
CREATE INDEX "deck_cards_logicalCardId_idx" ON "deck_cards"("logicalCardId");

-- CreateIndex
CREATE UNIQUE INDEX "deck_cards_deckId_logicalCardId_key" ON "deck_cards"("deckId", "logicalCardId");

-- CreateIndex
CREATE INDEX "deck_tags_deckId_idx" ON "deck_tags"("deckId");

-- CreateIndex
CREATE UNIQUE INDEX "deck_tags_deckId_tag_key" ON "deck_tags"("deckId", "tag");

-- CreateIndex
CREATE INDEX "inventory_items_userId_idx" ON "inventory_items"("userId");

-- CreateIndex
CREATE INDEX "inventory_items_cardPrintingId_idx" ON "inventory_items"("cardPrintingId");

-- CreateIndex
CREATE INDEX "inventory_items_collectionStatus_idx" ON "inventory_items"("collectionStatus");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_items_userId_cardPrintingId_condition_language_co_key" ON "inventory_items"("userId", "cardPrintingId", "condition", "language", "collectionStatus");

-- CreateIndex
CREATE INDEX "deck_allocations_deckId_idx" ON "deck_allocations"("deckId");

-- CreateIndex
CREATE INDEX "deck_allocations_inventoryItemId_idx" ON "deck_allocations"("inventoryItemId");

-- CreateIndex
CREATE UNIQUE INDEX "deck_allocations_deckId_inventoryItemId_key" ON "deck_allocations"("deckId", "inventoryItemId");

-- CreateIndex
CREATE INDEX "inventory_transactions_userId_idx" ON "inventory_transactions"("userId");

-- CreateIndex
CREATE INDEX "inventory_transactions_inventoryItemId_idx" ON "inventory_transactions"("inventoryItemId");

-- CreateIndex
CREATE INDEX "inventory_transactions_createdAt_idx" ON "inventory_transactions"("createdAt");

-- CreateIndex
CREATE INDEX "battle_logs_userId_idx" ON "battle_logs"("userId");

-- CreateIndex
CREATE INDEX "battle_logs_importedAt_idx" ON "battle_logs"("importedAt");

-- CreateIndex
CREATE UNIQUE INDEX "matches_battleLogId_key" ON "matches"("battleLogId");

-- CreateIndex
CREATE INDEX "matches_userId_idx" ON "matches"("userId");

-- CreateIndex
CREATE INDEX "matches_deckId_idx" ON "matches"("deckId");

-- CreateIndex
CREATE INDEX "matches_opponentArchetypeId_idx" ON "matches"("opponentArchetypeId");

-- CreateIndex
CREATE INDEX "matches_formatId_idx" ON "matches"("formatId");

-- CreateIndex
CREATE INDEX "matches_playedAt_idx" ON "matches"("playedAt");

-- CreateIndex
CREATE INDEX "matches_result_idx" ON "matches"("result");

-- CreateIndex
CREATE INDEX "tournaments_userId_idx" ON "tournaments"("userId");

-- CreateIndex
CREATE INDEX "tournaments_formatId_idx" ON "tournaments"("formatId");

-- CreateIndex
CREATE INDEX "tournaments_date_idx" ON "tournaments"("date");

-- CreateIndex
CREATE UNIQUE INDEX "tournament_matches_matchId_key" ON "tournament_matches"("matchId");

-- CreateIndex
CREATE INDEX "tournament_matches_tournamentId_idx" ON "tournament_matches"("tournamentId");

-- CreateIndex
CREATE UNIQUE INDEX "tournament_matches_tournamentId_matchId_key" ON "tournament_matches"("tournamentId", "matchId");

-- CreateIndex
CREATE INDEX "audit_logs_userId_idx" ON "audit_logs"("userId");

-- CreateIndex
CREATE INDEX "audit_logs_entity_entityId_idx" ON "audit_logs"("entity", "entityId");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- AddForeignKey
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_printings" ADD CONSTRAINT "card_printings_logicalCardId_fkey" FOREIGN KEY ("logicalCardId") REFERENCES "card_logicals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_printings" ADD CONSTRAINT "card_printings_setId_fkey" FOREIGN KEY ("setId") REFERENCES "card_sets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "format_rules" ADD CONSTRAINT "format_rules_formatId_fkey" FOREIGN KEY ("formatId") REFERENCES "formats"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decks" ADD CONSTRAINT "decks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decks" ADD CONSTRAINT "decks_formatId_fkey" FOREIGN KEY ("formatId") REFERENCES "formats"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decks" ADD CONSTRAINT "decks_archetypeId_fkey" FOREIGN KEY ("archetypeId") REFERENCES "archetypes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deck_cards" ADD CONSTRAINT "deck_cards_deckId_fkey" FOREIGN KEY ("deckId") REFERENCES "decks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deck_cards" ADD CONSTRAINT "deck_cards_logicalCardId_fkey" FOREIGN KEY ("logicalCardId") REFERENCES "card_logicals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deck_tags" ADD CONSTRAINT "deck_tags_deckId_fkey" FOREIGN KEY ("deckId") REFERENCES "decks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_cardPrintingId_fkey" FOREIGN KEY ("cardPrintingId") REFERENCES "card_printings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deck_allocations" ADD CONSTRAINT "deck_allocations_deckId_fkey" FOREIGN KEY ("deckId") REFERENCES "decks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deck_allocations" ADD CONSTRAINT "deck_allocations_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "battle_logs" ADD CONSTRAINT "battle_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_battleLogId_fkey" FOREIGN KEY ("battleLogId") REFERENCES "battle_logs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_deckId_fkey" FOREIGN KEY ("deckId") REFERENCES "decks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_opponentArchetypeId_fkey" FOREIGN KEY ("opponentArchetypeId") REFERENCES "archetypes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_formatId_fkey" FOREIGN KEY ("formatId") REFERENCES "formats"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournaments" ADD CONSTRAINT "tournaments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournaments" ADD CONSTRAINT "tournaments_formatId_fkey" FOREIGN KEY ("formatId") REFERENCES "formats"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_matches" ADD CONSTRAINT "tournament_matches_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_matches" ADD CONSTRAINT "tournament_matches_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "deck_cards" ADD CONSTRAINT "deck_cards_quantity_positive" CHECK ("quantity" > 0);

ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_quantity_nonnegative" CHECK ("quantity" >= 0);

ALTER TABLE "deck_allocations" ADD CONSTRAINT "deck_allocations_quantity_positive" CHECK ("quantity" > 0);
