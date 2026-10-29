import path from "node:path";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db } from "./db.server";

/** Applies pending SQL migrations from ./drizzle. Safe to call concurrently (Drizzle locks). */
export async function runMigrations(): Promise<void> {
  await migrate(db, { migrationsFolder: path.resolve(process.cwd(), "drizzle") });
}
