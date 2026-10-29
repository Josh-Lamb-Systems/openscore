import { toCsv } from "~/lib/admin/csv";
import { buildResponsesCsvRows } from "~/lib/admin/responses-export";
import { parseResponseFilters } from "~/lib/admin/responses-filter";
import { exportResponses } from "~/server/admin-responses.server";
import { requireUser } from "~/server/auth.server";
import { getVersion, requireScorecard } from "~/server/scorecards.server";
import type { Route } from "./+types/responses-csv";

/** Byte-order mark so Excel opens the file as UTF-8. */
const BOM = "\uFEFF";

/**
 * GET /scorecards/:id/responses.csv?q=&data=&status=
 * One row per response; same filters as the Responses page (all pages).
 */
export async function loader({ request, params }: Route.LoaderArgs) {
  await requireUser(request);
  const sc = await requireScorecard(params.id);
  const { page: _page, ...filters } = parseResponseFilters(
    new URL(request.url).searchParams,
    sc.liveVersionId ? "live" : "test",
  );
  // Columns follow the latest definition: the live version for live data, otherwise the draft.
  const live = sc.liveVersionId && filters.data === "live" ? await getVersion(sc.liveVersionId) : null;
  const latest = live?.definition ?? sc.draftDefinition;
  const responses = await exportResponses(sc.id, filters);
  const csv = toCsv(buildResponsesCsvRows(latest, responses));
  const date = new Date().toISOString().slice(0, 10);
  const suffix = filters.data === "test" ? "-test" : filters.data === "all" ? "-all" : "";
  return new Response(`${BOM}${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${sc.slug}-responses${suffix}-${date}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
