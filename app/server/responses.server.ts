import { eq } from "drizzle-orm";
import type { Definition } from "~/lib/scorecard/schema";
import { db, schema } from "./db.server";
import { appUrl } from "./env.server";
import { getVersion } from "./scorecards.server";

export type ResponseRow = typeof schema.responses.$inferSelect;

export async function getResponse(id: string): Promise<ResponseRow | null> {
  const [row] = await db.select().from(schema.responses).where(eq(schema.responses.id, id)).limit(1);
  return row ?? null;
}

/** The definition a response was taken against: its pinned version, or the draft snapshot for test responses. */
export async function definitionForResponse(r: ResponseRow): Promise<{ definition: Definition; version: number | null }> {
  if (r.versionId) {
    const v = await getVersion(r.versionId);
    if (v) return { definition: v.definition, version: v.version };
  }
  if (r.testDefinition) return { definition: r.testDefinition, version: null };
  throw new Error(`Response ${r.id} has no definition`);
}

export function resultUrl(slug: string, resultToken: string): string {
  return appUrl(`/s/${slug}/r/${resultToken}`);
}
