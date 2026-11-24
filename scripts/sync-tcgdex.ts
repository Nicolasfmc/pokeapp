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

function readList(flag: string, envName: string): string[] | undefined {
  const arg = process.argv.find((value) => value.startsWith(`--${flag}=`));
  const raw = arg ? arg.slice(flag.length + 3) : process.env[envName];
  if (!raw) return undefined;
  const list = raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return list.length > 0 ? list : undefined;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not set");
    process.exit(1);
  }

  // Uso: npm run sync:tcgdex                 -> catálogo completo
  //      npm run sync:tcgdex -- --sets=sv05,me01  -> sync parcial (não desativa nada)
  const setIds = readList("sets", "TCGDEX_SYNC_SETS");
  const excludedSeriesIds = readList(
    "exclude-series",
    "TCGDEX_EXCLUDED_SERIES",
  );
  const started = Date.now();
  console.log(
    setIds
      ? `[tcgdex] sync parcial: ${setIds.join(", ")}`
      : "[tcgdex] sync completo (pode levar alguns minutos)",
  );

  const stats = await syncTcgdex(prisma, {
    language: process.env.TCGDEX_LANGUAGE ?? "en",
    concurrency: readConcurrency(),
    setIds,
    excludedSeriesIds,
    onProgress: (done, total) => console.log(`[tcgdex] persistidas ${done}/${total}`),
  });

  process.stdout.write(
    [
      `setsUpserted=${stats.setsUpserted}`,
      `setsDeactivated=${stats.setsDeactivated}`,
      `NEW=${stats.cardsNew}`,
      `UPDATED=${stats.cardsUpdated}`,
      `UNCHANGED=${stats.cardsUnchanged}`,
      `REMOVED=${stats.cardsRemoved}`,
      `logicalsCreated=${stats.logicalsCreated}`,
      `elapsed=${Math.round((Date.now() - started) / 1000)}s`,
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
