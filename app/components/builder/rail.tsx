import type { LucideIcon } from "lucide-react";
import { Link } from "react-router";
import { cn } from "~/lib/utils";

/** The ~72px icon rail on the far left of the builder. */
export function Rail({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <nav aria-label={label} className="flex w-[72px] shrink-0 flex-col items-center gap-1 border-r border-gray-200 bg-white py-3">
      {children}
    </nav>
  );
}

const itemClass = "group flex w-16 flex-col items-center gap-1 rounded-lg px-1 py-1.5 text-center text-[11px] leading-tight text-gray-700";

function RailIcon({ icon: Icon, active }: { icon: LucideIcon; active?: boolean }) {
  return (
    <span
      className={cn(
        "grid size-8 place-items-center rounded-md text-gray-700 group-hover:bg-gray-100",
        active && "bg-ink text-white group-hover:bg-ink",
      )}
    >
      <Icon className="size-4" />
    </span>
  );
}

export function RailButton({
  icon,
  label,
  active,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(itemClass, active && "bg-gray-100 font-medium text-ink")}
    >
      <RailIcon icon={icon} active={active} />
      {label}
    </button>
  );
}

export function RailLink({ icon, label, to }: { icon: LucideIcon; label: string; to: string }) {
  return (
    <Link to={to} className={itemClass}>
      <RailIcon icon={icon} />
      {label}
    </Link>
  );
}
