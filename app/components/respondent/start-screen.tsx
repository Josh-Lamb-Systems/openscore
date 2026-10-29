import { Check } from "lucide-react";
import { respondentStrings as t } from "~/lib/respondent-strings";
import type { StartScreen as StartScreenConfig } from "~/lib/scorecard/schema";
import { cn } from "~/lib/utils";
import { ThemedButton } from "./frame";

export interface StartScreenProps {
  startScreen: StartScreenConfig;
  /** The lead form card (lead form position "before"); replaces the Start button. */
  leadForm?: React.ReactNode;
  onStart: () => void;
  starting?: boolean;
  error?: string | null;
}

/**
 * The fixed start-screen template (docs/SPEC.md §7): title, subtitle,
 * description and bullets on the left; the lead form card (or image) on the right.
 */
export function StartScreen({ startScreen: s, leadForm, onStart, starting, error }: StartScreenProps) {
  const image = s.imageUrl ? (
    <img src={s.imageUrl} alt="" className="max-h-80 w-full rounded-[calc(var(--os-radius)*2)] object-cover" />
  ) : null;

  return (
    <div
      className={cn(
        "grid w-full items-center gap-10 lg:gap-16",
        leadForm || image ? "lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]" : "max-w-3xl",
      )}
    >
      <div>
        {leadForm && image && <div className="mb-8">{image}</div>}
        <h1 className="text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl">{s.title}</h1>
        {s.subtitle && <p className="mt-5 text-xl font-medium leading-snug sm:text-2xl">{s.subtitle}</p>}
        {s.description && <p className="mt-4 whitespace-pre-line text-lg leading-relaxed opacity-80">{s.description}</p>}
        {s.bullets.filter((b) => b.trim()).length > 0 && (
          <ul className="mt-6 space-y-3">
            {s.bullets
              .filter((b) => b.trim())
              .map((b, i) => (
                <li key={i} className="flex items-start gap-3 text-lg">
                  <Check aria-hidden className="mt-1 size-5 shrink-0 text-[var(--os-primary)]" strokeWidth={2.5} />
                  <span>{b}</span>
                </li>
              ))}
          </ul>
        )}
        {!leadForm && (
          <div className="mt-10">
            <ThemedButton onClick={onStart} disabled={starting} aria-busy={starting || undefined} className="min-w-48">
              {s.buttonLabel || t.start}
            </ThemedButton>
            {error && (
              <p role="alert" className="mt-3 text-sm font-medium text-red-600">
                {error}
              </p>
            )}
          </div>
        )}
      </div>

      {leadForm ? (
        <div className="rounded-[calc(var(--os-radius)*2)] bg-[color-mix(in_srgb,var(--os-text)_4%,var(--os-surface))] p-6 shadow-[0_8px_30px_-12px_rgb(0_0_0/0.25)] ring-1 ring-current/5 sm:p-8">
          {leadForm}
        </div>
      ) : (
        image && <div className="hidden lg:block">{image}</div>
      )}
    </div>
  );
}
