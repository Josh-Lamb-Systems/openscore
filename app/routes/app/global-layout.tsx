import { BookOpen, Building2, Filter, Palette, Users } from "lucide-react";
import { Outlet } from "react-router";
import { NavItem, NavSection, SideNav, SidebarLayout } from "~/components/app/nav";
import { useAppData } from "./layout";

export default function GlobalLayout() {
  const { user } = useAppData();
  return (
    <SidebarLayout
      sidebar={
        <>
          <SideNav>
            <NavItem to="/scorecards" icon={Filter}>
              Scorecards
            </NavItem>
            <NavItem to="/brand-kits" icon={Palette}>
              Brand kits
            </NavItem>
          </SideNav>
          <NavSection label="Organisation">
            <NavItem to="/settings/organisation" icon={Building2}>
              Settings
            </NavItem>
            <NavItem to="/settings/members" icon={Users}>
              Members{user.role === "admin" ? "" : ""}
            </NavItem>
          </NavSection>
          <NavSection label="Help">
            <a
              href="https://github.com/Josh-Lamb-Systems/openscore#readme"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-3 rounded-md px-3 py-1.5 text-[15px] text-gray-800 hover:bg-gray-100"
            >
              <BookOpen className="size-4 text-gray-700" /> Documentation
            </a>
          </NavSection>
        </>
      }
    >
      <Outlet />
    </SidebarLayout>
  );
}
