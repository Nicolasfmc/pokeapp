import { config } from "dotenv";
import { prisma } from "../server/database/client";
import { syncTcgdex } from "../server/tcgdex";

config();

function readConcurrency(): number | undefined {
  const raw = process.env.TCGDEX_SYNC_CONCURRENCY;
  if (!raw) {
    return undefined;
  }
  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value) || value < 1) {
    console.error(`TCGDEX_SYNC_CONCURRENCY inválido: ${raw}`);
    process.exit(1);
  }
  return value;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not set");
    process.exit(1);
  }

  const stats = await syncTcgdex(prisma, {
    language: process.env.TCGDEX_LANGUAGE ?? "en",
    concurrency: readConcurrency(),
  });

  process.stdout.write(
    [
      `setsUpserted=${stats.setsUpserted}`,
      `setsDeactivated=${stats.setsDeactivated}`,
      `cardsUpserted=${stats.cardsUpserted}`,
      `cardsDeactivated=${stats.cardsDeactivated}`,
      `logicalsCreated=${stats.logicalsCreated}`,
    ].join(" ") + "\n",
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch((error) => {
      console.error(error);
    });
  });
