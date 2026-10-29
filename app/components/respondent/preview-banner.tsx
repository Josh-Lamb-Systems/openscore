import { ArrowLeft } from "lucide-react";
import { respondentStrings as t } from "~/lib/respondent-strings";

/** Slim admin-styled banner shown above draft previews and test results. */
export function PreviewBanner({ scorecardId, label = t.previewBanner }: { scorecardId: string; label?: string }) {
  return (
    <div className="flex items-center justify-between gap-4 bg-ink px-4 py-2 font-sans text-sm text-white">
      <a
        href={`/scorecards/${scorecardId}/build/questions`}
        className="inline-flex shrink-0 items-center gap-1.5 rounded px-1 font-medium text-white/90 hover:text-white focus-visible:outline-2 focus-visible:outline-brand-500"
      >
        <ArrowLeft aria-hidden className="size-4" />
        {t.backToBuilder}
      </a>
      <p className="truncate text-right text-white/80">
        <span className="mr-2 inline-block rounded bg-amber-400 px-1.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-ink">
          Draft
        </span>
        {label}
      </p>
    </div>
  );
}
