-- Same-name Pokémon that play differently become different logical cards.
-- Existing rows keep gameplayKey '' until the next TCGdex sync splits them
-- and moves deck cards to the chosen version (server/tcgdex/remap.ts).
-- DropIndex
DROP INDEX "card_logicals_canonicalName_category_key";

-- AlterTable
ALTER TABLE "card_logicals" ADD COLUMN     "gameplayKey" TEXT NOT NULL DEFAULT '';

-- CreateIndex
CREATE UNIQUE INDEX "card_logicals_canonicalName_category_gameplayKey_key" ON "card_logicals"("canonicalName", "category", "gameplayKey");

