import { ScorecardFlow } from "~/components/respondent/flow";
import { PreviewBanner } from "~/components/respondent/preview-banner";
import { definitionSchema } from "~/lib/scorecard/schema";
import { requireUser } from "~/server/auth.server";
import { getScorecardTheme, requireScorecard } from "~/server/scorecards.server";
import type { Route } from "./+types/preview";

/**
 * Draft preview / test mode (signed-in only): the respondent flow against the
 * current DRAFT definition. Responses are stored with `isTest = true` and fire
 * webhooks with `isTest: true` (docs/SPEC.md §13).
 */
export async function loader({ params, request }: Route.LoaderArgs) {
  await requireUser(request);
  const scorecard = await requireScorecard(params.id);
  const parsed = definitionSchema.safeParse(scorecard.draftDefinition);
  if (!parsed.success) {
    throw new Response("The draft can't be previewed because it is not valid.", { status: 422 });
  }
  return {
    scorecard: { id: scorecard.id, name: scorecard.name },
    draftRevision: scorecard.draftUpdatedAt.getTime(),
    definition: parsed.data,
    theme: await getScorecardTheme(scorecard),
  };
}

export function meta({ loaderData }: Route.MetaArgs) {
  return [
    { title: loaderData ? `Preview · ${loaderData.scorecard.name}` : "Preview" },
    { name: "robots", content: "noindex, nofollow" },
  ];
}

export default function ScorecardPreview({ loaderData }: Route.ComponentProps) {
  const { scorecard, draftRevision, definition, theme } = loaderData;
  return (
    <ScorecardFlow
      // Remount (fresh state) when the draft changes between visits.
      key={draftRevision}
      definition={definition}
      theme={theme}
      target={{ scorecardId: scorecard.id, preview: true }}
      storageKey={`openscore:${scorecard.id}:draft:${draftRevision}`}
      banner={<PreviewBanner scorecardId={scorecard.id} />}
    />
  );
}
