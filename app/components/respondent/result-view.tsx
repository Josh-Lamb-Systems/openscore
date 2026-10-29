import { respondentStrings as t } from "~/lib/respondent-strings";
import type { Definition } from "~/lib/scorecard/schema";
import type { CategoryScore } from "~/lib/scoring/score";
import type { BrandTokens } from "~/lib/theme";
import { cn } from "~/lib/utils";
import { BrandLogo } from "./frame";

export interface ResultScore {
  overallPercent: number;
  tierId: string | null;
  categoryScores: CategoryScore[];
}

export interface ResultViewProps {
  definition: Definition;
  theme: BrandTokens;
  score: ResultScore;
  /** Lead fields keyed by field key (firstName, lastName, email, custom_*). */
  lead: Record<string, string | boolean>;
  className?: string;
  /** Show the logo placeholder when the theme has no logo (builder preview). Public pages pass false. */
  showLogoPlaceholder?: boolean;
}

/** Replaces {{firstName}}, {{lastName}}, {{score}} and {{tier}}; unknown or empty tokens become "". */
export function interpolate(template: string, vars: Record<string, string>): string {
  return template
    .replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) => vars[key] ?? "")
    .replace(/\s+([,.!?])/g, "$1")
    .replace(/,\s*$/, "")
    .trim();
}

function ScoreGauge({ percent, color, label }: { percent: number; color: string; label: string }) {
  const r = 54;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(100, percent));
  return (
    <div className="relative size-44 shrink-0">
      <svg viewBox="0 0 128 128" className="size-full -rotate-90">
        <circle cx="64" cy="64" r={r} fill="none" stroke="currentColor" strokeOpacity={0.1} strokeWidth={12} />
        <circle
          cx="64"
          cy="64"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={12}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - p / 100)}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-bold">{p}%</span>
        <span className="text-xs uppercase tracking-wide opacity-70">{label}</span>
      </div>
    </div>
  );
}

/**
 * The structured result page (docs/SPEC.md §6). Used by the public result route
 * and the result page builder preview.
 */
export function ResultView({ definition, theme, score, lead, className, showLogoPlaceholder = true }: ResultViewProps) {
  const { resultPage, tiers, categories } = definition;
  const tier = tiers.find((x) => x.id === score.tierId) ?? null;
  const content = tier ? resultPage.tierContent[tier.id] : undefined;
  const vars = {
    firstName: String(lead.firstName ?? ""),
    lastName: String(lead.lastName ?? ""),
    score: `${score.overallPercent}%`,
    tier: tier?.name ?? "",
  };
  const ctaHref = content?.ctaUrl ? (/^https?:\/\//i.test(content.ctaUrl) ? content.ctaUrl : `https://${content.ctaUrl}`) : null;

  return (
    <div className={cn("mx-auto w-full max-w-4xl px-4 py-8 sm:px-8", className)}>
      {(theme.logoUrl || showLogoPlaceholder) && (
        <header className="mb-8">
          <BrandLogo theme={theme} placeholder={showLogoPlaceholder} />
        </header>
      )}

      <section className="rounded-[calc(var(--os-radius)*2)] bg-[var(--os-surface)] p-6 shadow-sm sm:p-10">
        <div className="flex flex-col items-center gap-8 sm:flex-row sm:items-start">
          {resultPage.showOverallScore && (
            <ScoreGauge percent={score.overallPercent} color={tier?.color || theme.primaryColor} label={t.yourScore} />
          )}
          <div className="flex-1">
            <h1 className="text-3xl font-bold leading-tight sm:text-4xl">{interpolate(resultPage.headline, vars)}</h1>
            {tier && (
              <p className="mt-3 inline-block rounded-full px-3 py-1 text-sm font-semibold text-white" style={{ backgroundColor: tier.color || theme.primaryColor }}>
                {tier.name}
              </p>
            )}
            {content?.body && <div className="os-prose mt-4 text-lg" dangerouslySetInnerHTML={{ __html: content.body }} />}
          </div>
        </div>
      </section>

      {resultPage.showCategoryBreakdown && score.categoryScores.length > 0 && (
        <section className="mt-8 rounded-[calc(var(--os-radius)*2)] bg-[var(--os-surface)] p-6 shadow-sm sm:p-10">
          <h2 className="mb-6 text-2xl font-semibold">{t.categoryBreakdown}</h2>
          <div className="space-y-8">
            {score.categoryScores.map((cs) => {
              const catTier = tiers.find((x) => x.id === cs.tierId);
              const cat = categories.find((c) => c.id === cs.categoryId);
              const html = cs.tierId ? resultPage.categoryContent[cs.categoryId]?.[cs.tierId] : undefined;
              return (
                <div key={cs.categoryId}>
                  <div className="mb-2 flex items-baseline justify-between gap-4">
                    <h3 className="text-lg font-semibold">{cat?.name ?? cs.name}</h3>
                    <span className="font-semibold">{cs.percent}%</span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-current/10">
                    <div className="h-3 rounded-full" style={{ width: `${cs.percent}%`, backgroundColor: catTier?.color || theme.primaryColor }} />
                  </div>
                  {html && <div className="os-prose mt-3 opacity-90" dangerouslySetInnerHTML={{ __html: html }} />}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {content && (content.ctaLabel || content.ctaText) && (
        <section className="mt-8 rounded-[calc(var(--os-radius)*2)] bg-[var(--os-accent)] px-6 py-12 text-center text-white sm:px-10">
          {content.ctaText && <p className="mx-auto mb-6 max-w-2xl text-2xl font-semibold">{content.ctaText}</p>}
          {content.ctaLabel && (
            <a
              href={ctaHref ?? undefined}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-12 items-center rounded-[var(--os-radius)] bg-[var(--os-primary)] px-8 text-lg font-medium text-white hover:brightness-110"
            >
              {content.ctaLabel}
            </a>
          )}
        </section>
      )}

      {resultPage.footerText && <footer className="mt-10 text-center text-sm opacity-70">{resultPage.footerText}</footer>}
    </div>
  );
}
