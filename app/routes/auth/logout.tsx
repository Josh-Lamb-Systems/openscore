import { redirect } from "react-router";
import { redirectWithAuthCookies } from "~/server/auth-actions.server";
import { auth } from "~/server/auth.server";
import type { Route } from "./+types/logout";

export async function loader() {
  throw redirect("/");
}

export async function action({ request }: Route.ActionArgs) {
  const res = await auth.api.signOut({ headers: request.headers, asResponse: true });
  return redirectWithAuthCookies(res, "/login");
}
