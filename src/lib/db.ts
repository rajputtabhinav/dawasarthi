import postgres, { type Sql, type TransactionSql } from "postgres";

/**
 * Postgres client (Supabase-compatible) — replaces the old `src/lib/mongodb.ts`.
 *
 * Connection sourcing:
 *   1. `DATABASE_URL` (manual override, mostly for tests)
 *   2. `POSTGRES_PRISMA_URL` (Vercel Postgres / Supabase integration pgbouncer
 *      pooled URL — preferred on serverless)
 *   3. `POSTGRES_URL` (direct connection — used if pooler URL is missing)
 *
 * We cache a single `Sql` instance on `globalThis` so HMR + cold-start
 * connection storms don't open multiple pools.
 */

declare global {
  var __dawasarthiSql: Sql | undefined;
}

function resolveConnectionString(): string | null {
  return (
    process.env.DATABASE_URL?.trim() ||
    process.env.POSTGRES_PRISMA_URL?.trim() ||
    process.env.POSTGRES_URL?.trim() ||
    null
  );
}

/** Returns the shared SQL client, or null when no DB is configured (local dev). */
export function getSql(): Sql | null {
  if (globalThis.__dawasarthiSql) return globalThis.__dawasarthiSql;
  const conn = resolveConnectionString();
  if (!conn) return null;

  const sql = postgres(conn, {
    // Serverless-friendly defaults. The pgbouncer URL handles pooling for us,
    // so client-side pooling stays small.
    max: 1,
    idle_timeout: 20,
    connect_timeout: 10,
    // Auto-convert snake_case columns to camelCase property names on the
    // returned rows — keeps callsite code idiomatic without manual mapping.
    transform: postgres.camel,
    // Allow CREATE TABLE/CREATE INDEX etc. on bootstrap.
    prepare: false,
  });
  globalThis.__dawasarthiSql = sql;
  return sql;
}

/** True when a DB connection string is configured. Cheap, no IO. */
export function isDatabaseConfigured(): boolean {
  return resolveConnectionString() !== null;
}

/**
 * Run a callback inside a transaction with the shared client. Returns the
 * callback's value, or null when DB isn't configured.
 */
export async function withTransaction<T>(
  fn: (tx: TransactionSql) => Promise<T>,
): Promise<T | null> {
  const sql = getSql();
  if (!sql) return null;
  // postgres-js's `sql.begin` semantics: any thrown error rolls back.
  return sql.begin(async (tx) => fn(tx)) as Promise<T>;
}
