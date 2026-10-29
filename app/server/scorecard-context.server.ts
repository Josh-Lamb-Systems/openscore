import { and, eq } from "drizzle-orm";
import { setupProgress } from "~/lib/scorecard/setup";
import { db, schema } from "./db.server";
import { appUrl } from "./env.server";
import { getScorecardSummary } from "./scorecards.server";

/** Data for the scorecard layout: summary, public URL and setup checklist progress. */
export async function loadScorecardLayout(id: string) {
  const summary = await getScorecardSummary(id);
  const sc = summary.scorecard;
  const [testResponse] = await db
    .select({ id: schema.responses.id })
    .from(schema.responses)
    .where(and(eq(schema.responses.scorecardId, id), eq(schema.responses.isTest, true)))
    .limit(1);
  const progress = setupProgress({
    definition: sc.draftDefinition,
    hasBranding: !!sc.brandKitId || Object.keys(sc.themeOverrides ?? {}).length > 0,
    hasTestResponse: !!testResponse,
    isLive: summary.status === "live",
    completedSteps: sc.settings.completedSteps ?? [],
  });
  return {
    scorecard: { id: sc.id, name: sc.name, slug: sc.slug },
    status: summary.status,
    liveVersion: summary.liveVersion,
    hasUnpublishedChanges: summary.hasUnpublishedChanges,
    responseCount: summary.responseCount,
    publicUrl: appUrl(`/s/${sc.slug}`),
    progress,
  };
}
