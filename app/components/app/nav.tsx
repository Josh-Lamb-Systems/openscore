import { NavLink } from "react-router";
import { cn } from "~/lib/utils";

export function SideNav({ children, className }: { children: React.ReactNode; className?: string }) {
  return <nav className={cn("flex flex-col gap-0.5", className)}>{children}</nav>;
}

export function NavItem({
  to,
  icon: Icon,
  children,
  end,
  trailing,
  reloadDocument,
}: {
  to: string;
  icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  end?: boolean;
  trailing?: React.ReactNode;
  reloadDocument?: boolean;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      reloadDocument={reloadDocument}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-3 rounded-md px-3 py-1.5 text-[15px] text-gray-800 hover:bg-gray-100",
          isActive && "bg-gray-200/70 font-medium text-ink hover:bg-gray-200/70",
        )
      }
    >
      {Icon && <Icon className="size-4 shrink-0 text-gray-700" />}
      <span className="flex-1 truncate">{children}</span>
      {trailing}
    </NavLink>
  );
}

export function NavSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-6">
      <p className="mb-1 px-3 text-[11px] font-medium uppercase tracking-wider text-gray-500">{label}</p>
      <SideNav>{children}</SideNav>
    </div>
  );
}

/** Sidebar + scrollable main area used under the top bar. */
export function SidebarLayout({ sidebar, children }: { sidebar: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex min-h-0 flex-1">
      <aside className="w-64 shrink-0 overflow-y-auto border-r border-gray-200 px-2 py-4">{sidebar}</aside>
      <main className="min-w-0 flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}

/** Standard content width for admin pages. */
export function PageContainer({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("mx-auto w-full max-w-5xl px-10 py-8", className)}>{children}</div>;
}
