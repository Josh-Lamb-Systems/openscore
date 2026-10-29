import { RespondentFrame } from "~/components/respondent/frame";
import type { BrandTokens } from "~/lib/theme";
import { cn } from "~/lib/utils";

/** Miniature, themed mock of the start screen used on the setup and home pages. */
export function ScorecardThumbnail({
  theme,
  title,
  subtitle,
  bullets = [],
  className,
}: {
  theme: BrandTokens;
  title: string;
  subtitle?: string;
  bullets?: string[];
  className?: string;
}) {
  return (
    <div
      className={cn("w-48 shrink-0 overflow-hidden rounded-md border border-gray-200 shadow-md", className)}
      aria-hidden
    >
      <RespondentFrame theme={theme} className="flex h-32 gap-2 p-2.5">
        <div className="min-w-0 flex-1">
          {theme.logoUrl ? (
            <img src={theme.logoUrl} alt="" className="mb-1.5 h-3 w-auto object-contain" />
          ) : (
            <div className="mb-1.5 h-1.5 w-8 rounded-sm bg-current opacity-20" />
          )}
          <p className="line-clamp-2 text-[9px] font-semibold leading-tight">{title || "Untitled scorecard"}</p>
          {subtitle && <p className="mt-1 line-clamp-2 text-[6px] leading-snug opacity-70">{subtitle}</p>}
          <ul className="mt-1.5 space-y-0.5">
            {bullets.slice(0, 3).map((b, i) => (
              <li key={i} className="flex items-center gap-1 text-[5.5px] leading-tight opacity-80">
                <span className="size-1 shrink-0 rounded-full bg-[var(--os-primary)]" />
                <span className="truncate">{b}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="mt-3 w-16 shrink-0 space-y-1 self-start rounded-sm bg-[var(--os-surface)] p-1.5 shadow-sm">
          <div className="h-1.5 rounded-sm border border-current/15" />
          <div className="h-1.5 rounded-sm border border-current/15" />
          <div className="h-1.5 rounded-sm border border-current/15" />
          <div className="h-2 rounded-[2px] bg-[var(--os-primary)]" />
        </div>
      </RespondentFrame>
    </div>
  );
}
