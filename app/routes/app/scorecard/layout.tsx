import {
  ChevronDown,
  Home,
  ListOrdered,
  Megaphone,
  Paintbrush,
  PieChart,
  Plug,
  Settings,
  Users,
  Wrench,
} from "lucide-react";
import { useState } from "react";
import { Link, Outlet, useLocation, useRouteLoaderData } from "react-router";
import { NavItem, NavSection, SideNav, SidebarLayout } from "~/components/app/nav";
import { cn } from "~/lib/utils";
import { loadScorecardLayout } from "~/server/scorecard-context.server";
import type { Route } from "./+types/layout";

export async function loader({ params }: Route.LoaderArgs) {
  return loadScorecardLayout(params.id);
}

/** Layout data for any route nested under /scorecards/:id. */
export function useScorecard() {
  return useRouteLoaderData<typeof loader>("routes/app/scorecard/layout")!;
}

export function meta({ loaderData }: Route.MetaArgs) {
  return [{ title: `${loaderData?.scorecard.name ?? "Scorecard"} · OpenScore` }];
}

export default function ScorecardLayout({ loaderData }: Route.ComponentProps) {
  const { scorecard, progress } = loaderData;
  const base = `/scorecards/${scorecard.id}`;
  const location = useLocation();
  const [settingsOpen, setSettingsOpen] = useState(location.pathname.startsWith(`${base}/settings`));

  return (
    <SidebarLayout
      sidebar={
        <>
          <Link to={base} className="mx-1 mb-4 block rounded-lg border border-gray-200 p-3 hover:bg-gray-50">
            <p className="flex items-center gap-2 text-[15px] font-medium">
              <Wrench className="size-4" /> Scorecard Setup
            </p>
            <p className="mt-2 flex justify-between text-sm text-gray-700">
              <span>
                {progress.completed} of {progress.total} steps
              </span>
              <span className="font-medium">{progress.percent}%</span>
            </p>
            <div className="mt-2 h-1.5 rounded-full bg-gray-200">
              <div className="h-1.5 rounded-full bg-amber-500" style={{ width: `${progress.percent}%` }} />
            </div>
          </Link>
          <SideNav>
            <NavItem to={base} end icon={Wrench}>
              Scorecard Setup
            </NavItem>
            <NavItem to={`${base}/home`} icon={Home}>
              Scorecard Home
            </NavItem>
            <NavItem to={`${base}/responses`} icon={Users}>
              Responses
            </NavItem>
          </SideNav>
          <NavSection label="Build">
            <NavItem to={`${base}/build/questions`} icon={ListOrdered}>
              Questions
            </NavItem>
            <NavItem to={`${base}/build/results`} icon={PieChart}>
              Result Page
            </NavItem>
            <NavItem to={`${base}/theme`} icon={Paintbrush}>
              Theme
            </NavItem>
          </NavSection>
          <SideNav className="mt-6">
            <NavItem to={`${base}/share`} icon={Megaphone}>
              Share & Embed
            </NavItem>
            <NavItem to={`${base}/integrate`} icon={Plug}>
              Integrate
            </NavItem>
          </SideNav>
          <SideNav className="mt-6">
            <button
              type="button"
              onClick={() => setSettingsOpen((o) => !o)}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-1.5 text-left text-[15px] text-gray-800 hover:bg-gray-100",
                settingsOpen && "bg-gray-100",
              )}
              aria-expanded={settingsOpen}
            >
              <Settings className="size-4 text-gray-700" />
              <span className="flex-1">Settings</span>
              <ChevronDown className={cn("size-4 text-gray-500 transition-transform", settingsOpen && "rotate-180")} />
            </button>
            {settingsOpen && (
              <div className="ml-7 flex flex-col gap-0.5">
                <NavItem to={`${base}/settings/general`}>General</NavItem>
                <NavItem to={`${base}/settings/lead-form`}>Lead Form</NavItem>
                <NavItem to={`${base}/settings/tiers`}>Score Tiers</NavItem>
                <NavItem to={`${base}/settings/share-appearance`}>Share Appearance</NavItem>
              </div>
            )}
          </SideNav>
        </>
      }
    >
      <Outlet />
    </SidebarLayout>
  );
}
