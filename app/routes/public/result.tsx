import { data, redirect } from "react-router";
import { useEmbedResize } from "~/components/respondent/embed";
import { RespondentFrame } from "~/components/respondent/frame";
import { PreviewBanner } from "~/components/respondent/preview-banner";
import { ResultView } from "~/components/respondent/result-view";
import { resultPath } from "~/lib/respond-api";
import { respondentStrings as t } from "~/lib/respondent-strings";
import { cn } from "~/lib/utils";
import { definitionForResponse } from "~/server/responses.server";
import { getResponseByToken } from "~/server/respond.server";
import { getScorecard, getScorecardTheme } from "~/server/scorecards.server";
import type { Route } from "./+types/result";

/** Public, shareable result page: `/s/:slug/r/:token` (docs/SPEC.md §6). `?embed=1` drops the outer chrome. */
export async function loader({ params, request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const embed = url.searchParams.get("embed") === "1";
  const response = await getResponseByToken(params.token);
  const scorecard = response ? await getScorecard(response.scorecardId) : null;
  if (!response || !scorecard) throw data(t.notAvailable, { status: 404 });

  // Keep result links working after a slug change.
  if (scorecard.slug !== params.slug) {
    throw redirect(resultPath(scorecard.slug, response.resultToken) + url.search);
  }
  if (!response.completedAt) {
    const back = response.isTest ? `/scorecards/${scorecard.id}/preview` : `/${embed ? "embed" : "s"}/${scorecard.slug}`;
    throw redirect(back);
  }

  const { definition } = await definitionForResponse(response);
  const theme = await getScorecardTheme(scorecard);
  return {
    embed,
    isTest: response.isTest,
    scorecardId: scorecard.id,
    title: definition.startScreen.title,
    definition,
    theme,
    lead: response.lead,
    score: {
      overallPercent: response.overallPercent ?? 0,
      tierId: response.tierId,
      categoryScores: response.categoryScores ?? [],
    },
  };
}

export function headers() {
  return { "X-Robots-Tag": "noindex, nofollow", "Cache-Control": "private, no-store" };
}

export function meta({ loaderData }: Route.MetaArgs) {
  return [
    { title: loaderData ? `Your results · ${loaderData.title}` : t.notAvailable },
    { name: "robots", content: "noindex, nofollow" },
  ];
}

export default function PublicResult({ loaderData }: Route.ComponentProps) {
  const { embed, isTest, scorecardId, definition, theme, lead, score } = loaderData;
  const rootRef = useEmbedResize<HTMLDivElement>(embed);
  return (
    <div ref={rootRef} className={cn("flex flex-col", !embed && "min-h-dvh")}>
      {isTest && <PreviewBanner scorecardId={scorecardId} label={t.testResult} />}
      <RespondentFrame theme={theme} className="flex-1">
        <ResultView
          definition={definition}
          theme={theme}
          score={score}
          lead={lead}
          showLogoPlaceholder={false}
          className={embed ? "py-6" : "sm:py-12"}
        />
      </RespondentFrame>
    </div>
  );
}
