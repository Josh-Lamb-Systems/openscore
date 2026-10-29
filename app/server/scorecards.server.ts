import { and, count, desc, eq, isNotNull, max, sql } from "drizzle-orm";
import { data } from "react-router";
import { createDefaultDefinition } from "~/lib/scorecard/defaults";
import { definitionSchema, type Definition } from "~/lib/scorecard/schema";
import { validateForPublish, type ValidationIssue } from "~/lib/scorecard/validate";
import { resolveTheme, type BrandTokens } from "~/lib/theme";
import { db, schema } from "./db.server";
import { createId } from "./ids.server";

export type ScorecardRow = typeof schema.scorecards.$inferSelect;
export type ScorecardVersionRow = typeof schema.scorecardVersions.$inferSelect;

export type ScorecardStatus = "draft" | "live";

export function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "scorecard"
  );
}

export async function uniqueSlug(base: string, excludeId?: string): Promise<string> {
  const root = slugify(base);
  for (let i = 0; i < 100; i++) {
    const candidate = i === 0 ? root : `${root}-${i + 1}`;
    const [hit] = await db
      .select({ id: schema.scorecards.id })
      .from(schema.scorecards)
      .where(eq(schema.scorecards.slug, candidate))
      .limit(1);
    if (!hit || hit.id === excludeId) return candidate;
  }
  return `${root}-${createId("x").slice(2, 8)}`;
}

export async function listScorecards() {
  const rows = await db.select().from(schema.scorecards).orderBy(desc(schema.scorecards.updatedAt));
  const counts = await db
    .select({ scorecardId: schema.responses.scorecardId, n: count() })
    .from(schema.responses)
    .where(and(eq(schema.responses.isTest, false), isNotNull(schema.responses.leadCapturedAt)))
    .groupBy(schema.responses.scorecardId);
  const leadCounts = new Map(counts.map((c) => [c.scorecardId, c.n]));
  return rows.map((s) => ({
    id: s.id,
    name: s.name,
    slug: s.slug,
    status: (s.liveVersionId ? "live" : "draft") as ScorecardStatus,
    updatedAt: s.updatedAt,
    leads: leadCounts.get(s.id) ?? 0,
    title: s.draftDefinition.startScreen.title,
    subtitle: s.draftDefinition.startScreen.subtitle,
  }));
}

export async function getScorecard(id: string): Promise<ScorecardRow | null> {
  const [row] = await db.select().from(schema.scorecards).where(eq(schema.scorecards.id, id)).limit(1);
  return row ?? null;
}

/** Loads a scorecard or throws a 404 response. */
export async function requireScorecard(id: string): Promise<ScorecardRow> {
  const row = await getScorecard(id);
  if (!row) throw data("Scorecard not found", { status: 404 });
  return row;
}

export async function getVersion(versionId: string): Promise<ScorecardVersionRow | null> {
  const [row] = await db
    .select()
    .from(schema.scorecardVersions)
    .where(eq(schema.scorecardVersions.id, versionId))
    .limit(1);
  return row ?? null;
}

export async function createScorecard(name: string, userId: string): Promise<ScorecardRow> {
  const [orgRow] = await db.select().from(schema.orgSettings).limit(1);
  const [row] = await db
    .insert(schema.scorecards)
    .values({
      id: createId("sc"),
      slug: await uniqueSlug(name),
      name,
      draftDefinition: createDefaultDefinition(name),
      brandKitId: orgRow?.defaultBrandKitId ?? null,
      createdBy: userId,
    })
    .returning();
  return row;
}

export async function duplicateScorecard(id: string, userId: string): Promise<ScorecardRow> {
  const src = await requireScorecard(id);
  const name = `${src.name} (copy)`;
  const [row] = await db
    .insert(schema.scorecards)
    .values({
      id: createId("sc"),
      slug: await uniqueSlug(name),
      name,
      draftDefinition: src.draftDefinition,
      brandKitId: src.brandKitId,
      themeOverrides: src.themeOverrides,
      settings: { ...src.settings, completedSteps: [] },
      createdBy: userId,
    })
    .returning();
  return row;
}

export async function deleteScorecard(id: string): Promise<void> {
  await db.transaction(async (tx) => {
    // Responses reference versions with ON DELETE RESTRICT, so remove them first.
    await tx.delete(schema.responses).where(eq(schema.responses.scorecardId, id));
    await tx.delete(schema.scorecards).where(eq(schema.scorecards.id, id));
  });
}

/**
 * Replaces parts of the draft definition. Each editor saves only the keys it owns
 * (e.g. the question builder saves `questions` + `categories`), so concurrent
 * editors of different parts don't clobber each other.
 */
export async function updateDraft(id: string, patch: Partial<Omit<Definition, "schemaVersion">>): Promise<Definition> {
  const current = await requireScorecard(id);
  const next = definitionSchema.parse({ ...current.draftDefinition, ...patch });
  await db
    .update(schema.scorecards)
    .set({ draftDefinition: next, draftUpdatedAt: new Date() })
    .where(eq(schema.scorecards.id, id));
  return next;
}

export async function updateScorecard(
  id: string,
  patch: Partial<Pick<ScorecardRow, "name" | "slug" | "brandKitId" | "themeOverrides" | "settings">>,
): Promise<void> {
  await db.update(schema.scorecards).set(patch).where(eq(schema.scorecards.id, id));
}

export type PublishResult = { ok: true; version: number } | { ok: false; issues: ValidationIssue[] };

export async function publishScorecard(id: string, userId: string): Promise<PublishResult> {
  const sc = await requireScorecard(id);
  const issues = validateForPublish(sc.draftDefinition);
  if (issues.length > 0) return { ok: false, issues };
  const definition = definitionSchema.parse(sc.draftDefinition);

  return db.transaction(async (tx) => {
    const [{ latest }] = await tx
      .select({ latest: max(schema.scorecardVersions.version) })
      .from(schema.scorecardVersions)
      .where(eq(schema.scorecardVersions.scorecardId, id));
    const version = (latest ?? 0) + 1;
    const versionId = createId("ver");
    await tx.insert(schema.scorecardVersions).values({
      id: versionId,
      scorecardId: id,
      version,
      definition,
      publishedBy: userId,
    });
    await tx.update(schema.scorecards).set({ liveVersionId: versionId }).where(eq(schema.scorecards.id, id));
    return { ok: true as const, version };
  });
}

export async function unpublishScorecard(id: string): Promise<void> {
  await db.update(schema.scorecards).set({ liveVersionId: null }).where(eq(schema.scorecards.id, id));
}

/** Resets the draft to the currently live definition. */
export async function discardDraft(id: string): Promise<void> {
  const sc = await requireScorecard(id);
  if (!sc.liveVersionId) return;
  const live = await getVersion(sc.liveVersionId);
  if (!live) return;
  await db
    .update(schema.scorecards)
    .set({ draftDefinition: live.definition, draftUpdatedAt: live.publishedAt })
    .where(eq(schema.scorecards.id, id));
}

/** Summary used by the scorecard layout (top bar, sidebar, setup progress). */
export async function getScorecardSummary(id: string) {
  const sc = await requireScorecard(id);
  const live = sc.liveVersionId ? await getVersion(sc.liveVersionId) : null;
  const hasUnpublishedChanges =
    !!live && JSON.stringify(live.definition) !== JSON.stringify(sc.draftDefinition);
  const [{ n: responseCount }] = await db
    .select({ n: count() })
    .from(schema.responses)
    .where(and(eq(schema.responses.scorecardId, id), sql`${schema.responses.completedAt} is not null`));
  return {
    scorecard: sc,
    status: (sc.liveVersionId ? "live" : "draft") as ScorecardStatus,
    liveVersion: live ? { id: live.id, version: live.version, publishedAt: live.publishedAt } : null,
    hasUnpublishedChanges,
    responseCount,
  };
}

export async function getBrandKit(id: string | null) {
  if (!id) return null;
  const [kit] = await db.select().from(schema.brandKits).where(eq(schema.brandKits.id, id)).limit(1);
  return kit ?? null;
}

/** The effective theme for a scorecard: default tokens ← brand kit ← per-scorecard overrides. */
export async function getScorecardTheme(sc: ScorecardRow): Promise<BrandTokens> {
  const kit = await getBrandKit(sc.brandKitId);
  return resolveTheme(kit?.tokens, sc.themeOverrides);
}
