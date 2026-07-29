/**
 * One-shot DB migration runner. Reads `src/lib/schema.sql` and executes it
 * against the database pointed to by `DATABASE_URL` / `POSTGRES_URL_NON_POOLING`
 * / `POSTGRES_URL`.
 *
 * `POSTGRES_URL_NON_POOLING` is preferred for migrations because pgbouncer in
 * transaction-pooling mode (which the `POSTGRES_PRISMA_URL` uses) does not
 * support session-scoped DDL inside a single connection.
 *
 * Usage:
 *   npm run db:migrate
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCHEMA_PATH = path.join(__dirname, "../src/lib/schema.sql");

const conn =
  process.env.DATABASE_URL?.trim() ||
  process.env.POSTGRES_URL_NON_POOLING?.trim() ||
  process.env.POSTGRES_URL?.trim();

if (!conn) {
  console.error(
    "No database URL configured. Set DATABASE_URL or POSTGRES_URL_NON_POOLING in .env.local.",
  );
  process.exit(1);
}

if (!fs.existsSync(SCHEMA_PATH)) {
  console.error("schema.sql not found at", SCHEMA_PATH);
  process.exit(1);
}

const sql = postgres(conn, { max: 1, idle_timeout: 20, prepare: false });

try {
  const schema = fs.readFileSync(SCHEMA_PATH, "utf8");
  console.log("Applying schema from", SCHEMA_PATH, "…");
  // postgres-js: passing a raw string via the .unsafe() method runs it as a
  // multi-statement script. This is fine — we only run it ourselves with the
  // server-trusted schema file.
  await sql.unsafe(schema);
  console.log("✅ Schema applied successfully.");
} catch (err) {
  console.error("❌ Migration failed:", err);
  process.exitCode = 1;
} finally {
  await sql.end();
}
