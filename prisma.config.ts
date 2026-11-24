import { config } from "dotenv";
import { defineConfig } from "prisma/config";

config();

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "node --experimental-strip-types prisma/seed.ts",
  },
  datasource: {
    url:
      process.env.DATABASE_URL ??
      "postgresql://USER:PASSWORD@localhost:5432/sleevebuild?schema=public",
  },
});
