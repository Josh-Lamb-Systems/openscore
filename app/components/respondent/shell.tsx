import type { BrandTokens } from "~/lib/theme";
import { cn } from "~/lib/utils";
import { useEmbedResize } from "./embed";
import { BrandLogo, RespondentFrame } from "./frame";

/**
 * Page chrome for public respondent pages: themed background, a surface card
 * with the brand logo, the screen content and an optional footer. In embed
 * mode the outer padding/min-height are dropped and the height is posted to
 * the parent window.
 */
export function RespondentShell({
  theme,
  embed = false,
  banner,
  footer,
  mainRef,
  children,
}: {
  theme: BrandTokens;
  embed?: boolean;
  /** Rendered above the themed page (e.g. the draft preview banner). */
  banner?: React.ReactNode;
  footer?: React.ReactNode;
  mainRef?: React.Ref<HTMLElement>;
  children: React.ReactNode;
}) {
  const rootRef = useEmbedResize<HTMLDivElement>(embed);
  return (
    <div ref={rootRef} className={cn("flex flex-col", !embed && "min-h-dvh")}>
      {banner}
      <RespondentFrame theme={theme} className={cn("flex flex-1 flex-col", !embed && "sm:p-6 lg:p-10")}>
        <div
          className={cn(
            "mx-auto flex w-full flex-1 flex-col overflow-hidden bg-[var(--os-surface)]",
            !embed && "max-w-6xl sm:rounded-[calc(var(--os-radius)*2)] sm:shadow-[0_1px_3px_rgb(0_0_0/0.06),0_12px_40px_-20px_rgb(0_0_0/0.2)]",
          )}
        >
          {theme.logoUrl && (
            <header className="px-6 pt-6 sm:px-10 sm:pt-8">
              <BrandLogo theme={theme} placeholder={false} />
            </header>
          )}
          <main
            ref={mainRef}
            tabIndex={-1}
            className={cn(
              "flex flex-1 items-center px-6 py-10 outline-none sm:px-10 sm:py-14 lg:px-16",
              embed ? "min-h-[520px]" : "min-h-[60vh]",
            )}
          >
            {children}
          </main>
          {footer}
        </div>
      </RespondentFrame>
    </div>
  );
}
