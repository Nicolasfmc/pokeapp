import "server-only";
import { Pool, type QueryResultRow } from "pg";

/**
 * Connection to the platform database.
 *
 * Every connection starts in read-only mode (default_transaction_read_only),
 * so even a bug here can't change platform data. The only write the panel
 * does (the sign-in rate limit) opens an explicit READ WRITE transaction.
 * In production ADMIN_DATABASE_URL should also use a role that only has
 * SELECT grants (see README).
 */
const globalForPool = globalThis as unknown as { adminPool?: Pool };

function createPool() {
  const connectionString = process.env.ADMIN_DATABASE_URL;
  if (!connectionString) throw new Error("ADMIN_DATABASE_URL is not set");
  const pool = new Pool({
    connectionString,
    max: 3,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
    statement_timeout: 10_000,
    query_timeout: 15_000,
    application_name: "sleevebuild-admin",
  });
  pool.on("connect", (client) => {
    client.query("SET default_transaction_read_only = on").catch((error) => {
      console.error("admin db: could not enable read-only mode", error);
      client.release(error);
    });
  });
  return pool;
}

function pool(): Pool {
  globalForPool.adminPool ??= createPool();
  return globalForPool.adminPool;
}

/** Parameterized query: values always go in `params`, never in `text`. */
export async function query<T extends QueryResultRow>(
  text: string,
  params: ReadonlyArray<unknown> = [],
): Promise<T[]> {
  const result = await pool().query<T>(text, params as unknown[]);
  return result.rows;
}

/** Runs `fn` inside a READ WRITE transaction (only for the rate limiter). */
export async function withWriteTransaction<R>(
  fn: (run: <T extends QueryResultRow>(text: string, params?: ReadonlyArray<unknown>) => Promise<T[]>) => Promise<R>,
): Promise<R> {
  const client = await pool().connect();
  try {
    await client.query("BEGIN READ WRITE");
    const result = await fn(async (text, params = []) => (await client.query(text, params as unknown[])).rows);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
