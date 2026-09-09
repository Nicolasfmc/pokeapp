import { createRequire } from "node:module";
import { PrismaClient } from "@prisma/client";

const require = createRequire(import.meta.url);

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL is not set");
    throw new Error("DATABASE_URL is not set");
  }

  let PrismaPg: new (config: { connectionString: string }) => unknown;
  try {
    ({ PrismaPg } = require("@prisma/adapter-pg") as {
      PrismaPg: new (config: { connectionString: string }) => unknown;
    });
  } catch (error) {
    console.error(error);
    throw new Error(
      "Dependências ausentes: @prisma/adapter-pg e pg (obrigatórias no Prisma 7)",
    );
  }

  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter: adapter as never });
}

const prisma = createPrismaClient();

async function main() {
  const formats = [
    {
      code: "STANDARD",
      name: "Standard",
      description: "Formato Standard do Pokémon TCG",
      rules: [
        { key: "deck_size", value: { min: 60, max: 60 } },
        { key: "max_copies", value: { default: 4 } },
      ],
    },
    {
      code: "EXPANDED",
      name: "Expanded",
      description: "Formato Expanded do Pokémon TCG",
      rules: [
        { key: "deck_size", value: { min: 60, max: 60 } },
        { key: "max_copies", value: { default: 4 } },
      ],
    },
  ] as const;

  for (const format of formats) {
    const record = await prisma.format.upsert({
      where: { code: format.code },
      create: {
        code: format.code,
        name: format.name,
        description: format.description,
      },
      update: {
        name: format.name,
        description: format.description,
        isActive: true,
      },
    });

    for (const rule of format.rules) {
      await prisma.formatRule.upsert({
        where: {
          formatId_key: {
            formatId: record.id,
            key: rule.key,
          },
        },
        create: {
          formatId: record.id,
          key: rule.key,
          value: rule.value,
        },
        update: {
          value: rule.value,
        },
      });
    }
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
