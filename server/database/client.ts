import { createRequire } from "node:module";
import { PrismaClient } from "@prisma/client";

const require = createRequire(import.meta.url);

const globalForPrisma = globalThis as typeof globalThis & {
  prisma?: PrismaClient;
};

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

  return new PrismaClient({
    adapter: adapter as never,
    log: [
      { emit: "stdout", level: "error" },
      { emit: "stdout", level: "warn" },
    ],
  });
}

function getPrismaClient() {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient();
  }
  return globalForPrisma.prisma;
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, property, receiver) {
    const client = getPrismaClient();
    const value = Reflect.get(client, property, receiver);
    return typeof value === "function" ? value.bind(client) : value;
  },
});

export default prisma;
