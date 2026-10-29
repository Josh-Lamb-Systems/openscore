import { redirect } from "react-router";
import { requireUser } from "~/server/auth.server";
import type { Route } from "./+types/index";

export async function loader({ request }: Route.LoaderArgs) {
  await requireUser(request);
  throw redirect("/scorecards");
}
