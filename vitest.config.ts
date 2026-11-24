import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
  test: {
    // Testes de integração (tests/integration) usam o PostgreSQL de DATABASE_URL
    // e só rodam com RUN_DB_TESTS=1 (ver README).
    fileParallelism: false,
  },
});
