import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
import { env } from "./env.server";
import * as schema from "./schema.server";

export type Db = NodePgDatabase<typeof schema>;

declare global {
  // Reuse the pool across dev HMR reloads.
  var __openscoreDb: { pool: pg.Pool; db: Db } | undefined;
}

function create() {
  const pool = new pg.Pool({ connectionString: env().DATABASE_URL, max: 10 });
  return { pool, db: drizzle(pool, { schema }) };
}

const instance = (globalThis.__openscoreDb ??= create());

export const db: Db = instance.db;
export const pool = instance.pool;
export { schema };
