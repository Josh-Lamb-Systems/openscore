import { asc } from "drizzle-orm";
import { ChevronDown, CircleHelp, ExternalLink, Plus } from "lucide-react";
import { Form, Link, Outlet, useRouteLoaderData } from "react-router";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Logo, StatusPill } from "~/components/ui/misc";
import { authMiddleware, userContext } from "~/server/auth.server";
import { db, schema } from "~/server/db.server";
import type { Route } from "./+types/layout";
import type { loader as scorecardLayoutLoader } from "./scorecard/layout";

export const middleware: Route.MiddlewareFunction[] = [authMiddleware];

export async function loader({ context }: Route.LoaderArgs) {
  const user = context.get(userContext)!;
  const [org] = await db.select().from(schema.orgSettings).limit(1);
  const scorecards = await db
    .select({ id: schema.scorecards.id, name: schema.scorecards.name })
    .from(schema.scorecards)
    .orderBy(asc(schema.scorecards.name));
  return { user, orgName: org?.name ?? "My organisation", scorecards };
}

export function useAppData() {
  return useRouteLoaderData<typeof loader>("routes/app/layout")!;
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default function AppLayout({ loaderData }: Route.ComponentProps) {
  const { user, orgName, scorecards } = loaderData;
  const current = useRouteLoaderData<typeof scorecardLayoutLoader>("routes/app/scorecard/layout");

  return (
    <div className="flex h-screen flex-col">
      <header className="flex h-14 shrink-0 items-center gap-4 border-b border-gray-200 bg-white px-4">
        <Link to="/scorecards" aria-label="OpenScore home">
          <Logo />
        </Link>
        <div className="h-6 w-px bg-gray-200" />
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-1 rounded px-1 text-[15px] text-gray-900 hover:bg-gray-100">
            {orgName} <ChevronDown className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem asChild>
              <Link to="/settings/organisation">Organisation settings</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/settings/members">Members</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/brand-kits">Brand kits</Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-1 rounded px-1 text-[15px] text-gray-900 hover:bg-gray-100">
            {current?.scorecard.name ?? "Select Scorecard"} <ChevronDown className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="max-h-96 overflow-y-auto">
            <DropdownMenuLabel>Scorecards</DropdownMenuLabel>
            {scorecards.map((s) => (
              <DropdownMenuItem key={s.id} asChild>
                <Link to={`/scorecards/${s.id}/home`}>{s.name}</Link>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/scorecards?create=1">
                <Plus /> New scorecard
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        {current && (
          <>
            <StatusPill tone={current.status === "live" ? "live" : "draft"}>
              {current.status === "live" ? "Live" : "Draft mode"}
            </StatusPill>
            <a
              href={current.status === "live" ? current.publicUrl : `/scorecards/${current.scorecard.id}/preview`}
              target="_blank"
              rel="noreferrer"
              className="text-brand-600 hover:text-brand-700"
              aria-label="Open scorecard in a new tab"
            >
              <ExternalLink className="size-4" />
            </a>
          </>
        )}
        <div className="ml-auto flex items-center gap-3">
          <a
            href="https://github.com/Josh-Lamb-Systems/openscore"
            target="_blank"
            rel="noreferrer"
            className="grid size-9 place-items-center rounded-md border border-gray-200 text-gray-700 hover:bg-gray-50"
            aria-label="Help"
          >
            <CircleHelp className="size-5" />
          </a>
          <DropdownMenu>
            <DropdownMenuTrigger
              className="grid size-9 place-items-center rounded-full bg-gray-200 text-sm font-medium text-gray-700"
              aria-label="Account menu"
            >
              {initials(user.name)}
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuLabel>
                {user.name}
                <span className="block font-normal">{user.email}</span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/account">Account</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Form method="post" action="/logout">
                  <button type="submit" className="w-full text-left">
                    Sign out
                  </button>
                </Form>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
      <Outlet />
    </div>
  );
}
