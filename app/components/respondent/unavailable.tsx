import { respondentStrings as t } from "~/lib/respondent-strings";
import type { BrandTokens } from "~/lib/theme";
import { RespondentShell } from "./shell";

/** Themed "This scorecard isn't available right now." page (unpublished or unknown slug). */
export function Unavailable({ theme, embed }: { theme: BrandTokens; embed?: boolean }) {
  return (
    <RespondentShell theme={theme} embed={embed}>
      <div className="mx-auto max-w-lg text-center">
        <h1 className="text-3xl font-semibold leading-tight">{t.notAvailable}</h1>
        <p className="mt-3 text-lg opacity-70">{t.notAvailableHint}</p>
      </div>
    </RespondentShell>
  );
}
