import { and, count, desc, eq, gte, ilike, inArray, isNotNull, isNull, or, sql, type SQL } from "drizzle-orm";
import type { ExportResponse } from "~/lib/admin/responses-export";
import { RESPONSES_PAGE_SIZE, type ResponseFilters } from "~/lib/admin/responses-filter";
import type { Definition, Tier } from "~/lib/scorecard/schema";
import { db, schema } from "./db.server";

const r = schema.responses;
const v = schema.scorecardVersions;

function filterWhere(scorecardId: string, f: Omit<ResponseFilters, "page">): SQL {
  const parts: (SQL | undefined)[] = [eq(r.scorecardId, scorecardId)];
  if (f.data === "live") parts.push(eq(r.isTest, false));
  if (f.data === "test") parts.push(eq(r.isTest, true));
  if (f.status === "completed") parts.push(isNotNull(r.completedAt));
  if (f.status === "incomplete") parts.push(isNull(r.completedAt));
  if (f.q) {
    const like = `%${f.q.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
    parts.push(
      or(
        ilike(r.email, like),
        sql`(coalesce(${r.lead}->>'firstName', '') || ' ' || coalesce(${r.lead}->>'lastName', '')) ilike ${like}`,
        sql`${r.lead}->>'email' ilike ${like}`,
      ),
    );
  }
  return and(...parts)!;
}

export function leadName(lead: Record<string, string | boolean> | null | undefined): string {
  const first = typeof lead?.firstName === "string" ? lead.firstName : "";
  const last = typeof lead?.lastName === "string" ? lead.lastName : "";
  return `${first} ${last}`.trim();
}

const listColumns = {
  id: r.id,
  lead: r.lead,
  email: r.email,
  isTest: r.isTest,
  startedAt: r.startedAt,
  completedAt: r.completedAt,
  overallPercent: r.overallPercent,
  tierId: r.tierId,
  // Only the tiers of the definition the response was taken against.
  tiers: sql<Tier[] | null>`coalesce(${v.definition}->'tiers', ${r.testDefinition}->'tiers')`,
};

function listQuery() {
  return db.select(listColumns).from(r).leftJoin(v, eq(v.id, r.versionId)).$dynamic();
}

type ListRow = Awaited<ReturnType<typeof listQuery>>[number];

function toListItem(row: ListRow) {
  const tier = row.tierId ? (row.tiers ?? []).find((t) => t.id === row.tierId) : null;
  const email = row.email ?? (typeof row.lead?.email === "string" ? row.lead.email : null);
  return {
    id: row.id,
    name: leadName(row.lead),
    email,
    isTest: row.isTest,
    startedAt: row.startedAt,
    completedAt: row.completedAt,
    overallPercent: row.overallPercent,
    tier: tier ? { name: tier.name, color: tier.color } : null,
  };
}

export type ResponseListItem = ReturnType<typeof toListItem>;

export async function listResponses(scorecardId: string, f: ResponseFilters) {
  const where = filterWhere(scorecardId, f);
  const [{ total }] = await db.select({ total: count() }).from(r).where(where);
  const pageCount = Math.max(1, Math.ceil(total / RESPONSES_PAGE_SIZE));
  const page = Math.min(f.page, pageCount);
  const rows = await listQuery()
    .where(where)
    .orderBy(desc(r.startedAt), desc(r.id))
    .limit(RESPONSES_PAGE_SIZE)
    .offset((page - 1) * RESPONSES_PAGE_SIZE);
  return { items: rows.map(toListItem), total, page, pageCount };
}

export async function recentResponses(scorecardId: string, limit = 5) {
  const rows = await listQuery()
    .where(and(eq(r.scorecardId, scorecardId), eq(r.isTest, false)))
    .orderBy(desc(r.startedAt))
    .limit(limit);
  return rows.map(toListItem);
}

export async function countResponses(scorecardId: string, isTest: boolean): Promise<number> {
  const [{ n }] = await db
    .select({ n: count() })
    .from(r)
    .where(and(eq(r.scorecardId, scorecardId), eq(r.isTest, isTest)));
  return n;
}

/** Deletes responses that belong to the scorecard. Returns how many were removed. */
export async function deleteResponses(scorecardId: string, ids: string[]): Promise<number> {
  if (ids.length === 0) return 0;
  const deleted = await db
    .delete(r)
    .where(and(eq(r.scorecardId, scorecardId), inArray(r.id, ids)))
    .returning({ id: r.id });
  return deleted.length;
}

/** Live (non-test) totals for responses started in the last `days` days (null = all time). */
export async function overviewStats(scorecardId: string, days: number | null) {
  const since = days == null ? null : new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const [row] = await db
    .select({
      started: count(),
      leads: sql<number>`count(*) filter (where ${r.leadCapturedAt} is not null)`.mapWith(Number),
      completed: sql<number>`count(*) filter (where ${r.completedAt} is not null)`.mapWith(Number),
    })
    .from(r)
    .where(and(eq(r.scorecardId, scorecardId), eq(r.isTest, false), since ? gte(r.startedAt, since) : undefined));
  const completionRate = row.started > 0 ? Math.round((100 * row.completed) / row.started) : null;
  return { ...row, completionRate };
}

/** All responses matching the filters with the definition each was answered against. */
export async function exportResponses(
  scorecardId: string,
  f: Omit<ResponseFilters, "page">,
): Promise<ExportResponse[]> {
  const rows = await db
    .select({ response: r, versionDefinition: v.definition })
    .from(r)
    .leftJoin(v, eq(v.id, r.versionId))
    .where(filterWhere(scorecardId, f))
    .orderBy(desc(r.startedAt));
  return rows.flatMap(({ response, versionDefinition }) => {
    const definition: Definition | null = versionDefinition ?? response.testDefinition;
    if (!definition) return [];
    return [
      {
        id: response.id,
        startedAt: response.startedAt,
        completedAt: response.completedAt,
        isTest: response.isTest,
        lead: response.lead ?? {},
        consent: response.consent,
        overallPercent: response.overallPercent,
        tierId: response.tierId,
        categoryScores: response.categoryScores,
        answers: response.answers ?? {},
        definition,
      },
    ];
  });
}
