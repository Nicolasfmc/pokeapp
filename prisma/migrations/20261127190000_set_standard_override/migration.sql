-- Manual Standard legality per set (admin panel) + the automatic value kept apart.
ALTER TABLE "card_sets"
  ADD COLUMN "standardOverride" BOOLEAN,
  ADD COLUMN "standardOverrideById" TEXT,
  ADD COLUMN "standardOverrideAt" TIMESTAMP(3);

ALTER TABLE "card_printings"
  ADD COLUMN "legalStandardAuto" BOOLEAN NOT NULL DEFAULT false;

-- Until now legalStandard was the automatic value.
UPDATE "card_printings" SET "legalStandardAuto" = "legalStandard";
