-- AlterTable
ALTER TABLE "decks" ADD COLUMN     "coverPrintingId" TEXT;

-- AddForeignKey
ALTER TABLE "decks" ADD CONSTRAINT "decks_coverPrintingId_fkey" FOREIGN KEY ("coverPrintingId") REFERENCES "card_printings"("id") ON DELETE SET NULL ON UPDATE CASCADE;
