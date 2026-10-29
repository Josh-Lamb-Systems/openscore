import { useRouteLoaderData } from "react-router";
import type { loader } from "~/routes/builder/layout";

/** Loader data of the builder layout (scorecard id, name, saved draft, theme, status). */
export function useBuilderData() {
  const data = useRouteLoaderData<typeof loader>("routes/builder/layout");
  if (!data) throw new Error("useBuilderData must be used under routes/builder/layout");
  return data;
}
