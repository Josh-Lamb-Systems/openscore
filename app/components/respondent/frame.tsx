import type { BrandTokens } from "~/lib/theme";
import { themeFontHref, themeStyle } from "~/lib/theme";
import { cn } from "~/lib/utils";
import { respondentStrings as t } from "~/lib/respondent-strings";

/**
 * Themed wrapper for every respondent-facing view. Sets the --os-* CSS variables
 * from the brand tokens and loads the theme font.
 */
export function RespondentFrame({
  theme,
  className,
  children,
}: {
  theme: BrandTokens;
  className?: string;
  children: React.ReactNode;
}) {
  const fontHref = themeFontHref(theme);
  return (
    <div style={themeStyle(theme)} className={cn("min-h-full", className)}>
      {fontHref && <link rel="stylesheet" href={fontHref} />}
      {children}
    </div>
  );
}

export function BrandLogo({
  theme,
  className,
  placeholder = true,
}: {
  theme: BrandTokens;
  className?: string;
  /** Show a "Your brand logo" placeholder when no logo is set (builder canvas). Public pages pass false. */
  placeholder?: boolean;
}) {
  if (!theme.logoUrl) {
    if (!placeholder) return null;
    return (
      <div className={cn("inline-flex h-10 items-center rounded border border-dashed border-current/20 px-3 text-xs font-semibold uppercase tracking-wide opacity-40", className)}>
        Your brand logo
      </div>
    );
  }
  return <img src={theme.logoUrl} alt="" className={cn("h-10 w-auto object-contain", className)} />;
}

export function ProgressBar({ percent }: { percent: number }) {
  const p = Math.max(0, Math.min(100, Math.round(percent)));
  return (
    <div className="mx-auto w-64 text-center" role="progressbar" aria-valuenow={p} aria-valuemin={0} aria-valuemax={100}>
      <p className="mb-1.5 text-base opacity-80">{t.complete(p)}</p>
      <div className="h-1 rounded-full" style={{ backgroundColor: "color-mix(in srgb, var(--os-primary) 35%, transparent)" }}>
        <div className="h-1 rounded-full bg-[var(--os-primary)] transition-all" style={{ width: `${p}%` }} />
      </div>
    </div>
  );
}

/** Primary themed button. */
export function ThemedButton({
  className,
  variant = "solid",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "solid" | "outline" }) {
  return (
    <button
      type="button"
      className={cn(
        "min-h-12 rounded-[var(--os-radius)] px-6 text-lg font-medium transition-[filter,background-color] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--os-primary)] disabled:cursor-not-allowed disabled:opacity-50",
        variant === "solid"
          ? "bg-[var(--os-primary)] text-white hover:brightness-110"
          : "border-2 border-[var(--os-primary)] bg-transparent text-[var(--os-primary)] hover:bg-[color-mix(in_srgb,var(--os-primary)_8%,transparent)]",
        className,
      )}
      {...props}
    />
  );
}
