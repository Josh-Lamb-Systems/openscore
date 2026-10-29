import { Outlet } from "react-router";
import { BuilderShell } from "~/components/builder/shell";
import { authMiddleware } from "~/server/auth.server";
import { getScorecardTheme, requireScorecard } from "~/server/scorecards.server";
import type { Route } from "./+types/layout";

export const middleware: Route.MiddlewareFunction[] = [authMiddleware];

export async function loader({ params }: Route.LoaderArgs) {
  const sc = await requireScorecard(params.id);
  const theme = await getScorecardTheme(sc);
  return {
    id: sc.id,
    name: sc.name,
    draftDefinition: sc.draftDefinition,
    theme,
    status: (sc.liveVersionId ? "live" : "draft") as "draft" | "live",
  };
}

export function meta({ loaderData }: Route.MetaArgs) {
  return [{ title: `Build · ${loaderData?.name ?? "Scorecard"} · OpenScore` }];
}

export default function BuilderLayout({ loaderData }: Route.ComponentProps) {
  return (
    <BuilderShell
      key={loaderData.id}
      scorecardId={loaderData.id}
      name={loaderData.name}
      status={loaderData.status}
      definition={loaderData.draftDefinition}
    >
      <Outlet />
    </BuilderShell>
  );
}
