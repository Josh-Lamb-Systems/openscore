import { data } from "react-router";
import { ScorecardFlow } from "~/components/respondent/flow";
import { Unavailable } from "~/components/respondent/unavailable";
import { respondentStrings as t } from "~/lib/respondent-strings";
import { DEFAULT_BRAND_TOKENS } from "~/lib/theme";
import { appUrl } from "~/server/env.server";
import { loadPublicScorecard } from "~/server/respond.server";
import type { Route } from "./+types/scorecard";

/**
 * Public respondent flow. Serves both `/s/:slug` (hosted page) and
 * `/embed/:slug` (route id `embed-scorecard`, rendered inside the /embed.js iframe).
 */
export async function loader({ params, request }: Route.LoaderArgs) {
  const embed = new URL(request.url).pathname.startsWith("/embed/");
  const loaded = await loadPublicScorecard(params.slug);
  if (!loaded?.live) {
    return data(
      { available: false as const, embed, theme: loaded?.theme ?? DEFAULT_BRAND_TOKENS },
      { status: 404 },
    );
  }
  const { scorecard, theme, live } = loaded;
  const { definition } = live;
  return {
    available: true as const,
    embed,
    theme,
    scorecard: { id: scorecard.id, slug: scorecard.slug },
    versionId: live.versionId,
    definition,
    share: {
      title: scorecard.settings.shareTitle || definition.startScreen.title,
      description: scorecard.settings.shareDescription || definition.startScreen.subtitle,
      imageUrl: scorecard.settings.shareImageUrl || null,
      url: appUrl(`/s/${scorecard.slug}`),
    },
  };
}

export function meta({ loaderData }: Route.MetaArgs) {
  if (!loaderData?.available) {
    return [{ title: t.notAvailable }, { name: "robots", content: "noindex" }];
  }
  const { share, embed } = loaderData;
  const tags = [
    { title: share.title },
    { name: "description", content: share.description },
    { property: "og:type", content: "website" },
    { property: "og:title", content: share.title },
    { property: "og:description", content: share.description },
    { property: "og:url", content: share.url },
    { name: "twitter:card", content: share.imageUrl ? "summary_large_image" : "summary" },
    { name: "twitter:title", content: share.title },
    { name: "twitter:description", content: share.description },
  ];
  if (share.imageUrl) {
    tags.push({ property: "og:image", content: share.imageUrl }, { name: "twitter:image", content: share.imageUrl });
  }
  if (embed) {
    tags.push({ name: "robots", content: "noindex" });
    tags.push({ tagName: "link", rel: "canonical", href: share.url } as unknown as (typeof tags)[number]);
  }
  return tags;
}

export default function PublicScorecard({ loaderData }: Route.ComponentProps) {
  if (!loaderData.available) {
    return <Unavailable theme={loaderData.theme} embed={loaderData.embed} />;
  }
  const { definition, theme, scorecard, versionId, embed } = loaderData;
  return (
    <ScorecardFlow
      definition={definition}
      theme={theme}
      embed={embed}
      target={{ slug: scorecard.slug, versionId }}
      storageKey={`openscore:${scorecard.id}:${versionId}`}
    />
  );
}
