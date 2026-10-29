import { handleRespond } from "~/server/respond.server";
import type { Route } from "./+types/api.respond";

/** Respondent API (JSON). See app/lib/respond-api.ts for the protocol. */
export async function action({ request }: Route.ActionArgs) {
  return handleRespond(request);
}

export function loader() {
  return Response.json({ ok: false, error: "Method not allowed" }, { status: 405, headers: { Allow: "POST" } });
}
