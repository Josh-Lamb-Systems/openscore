/** Applies database migrations. Skipped when RUN_MIGRATIONS=false. */
import { pool } from "~/server/db.server";
import { env } from "~/server/env.server";
import { runMigrations } from "~/server/migrate.server";

if (!env().RUN_MIGRATIONS && !process.argv.includes("--force")) {
  console.info("[migrate] RUN_MIGRATIONS=false; skipping");
} else {
  await runMigrations();
  console.info("[migrate] database is up to date");
}
await pool.end();
