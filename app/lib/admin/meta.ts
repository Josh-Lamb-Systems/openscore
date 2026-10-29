type MatchLike = { id: string; loaderData?: unknown } | undefined;

/** `<title>` for pages under /scorecards/:id, e.g. "Responses · My Scorecard · OpenScore". */
export function scorecardTitle(page: string, matches: readonly MatchLike[]) {
  const layout = matches.find((m) => m?.id === "routes/app/scorecard/layout")?.loaderData as
    { scorecard?: { name?: string } } | undefined;
  const name = layout?.scorecard?.name;
  return [{ title: [page, name, "OpenScore"].filter(Boolean).join(" · ") }];
}
