import { Settings } from "lucide-react";
import { useRef } from "react";
import { Link } from "react-router";
import { RespondentFrame } from "~/components/respondent/frame";
import { ResultView, type ResultScore } from "~/components/respondent/result-view";
import { RichTextEditor } from "~/components/ui/rich-text-editor";
import { SwitchRow } from "~/components/ui/switch";
import type { Answers, Definition, ResultPage, Tier, TierContent } from "~/lib/scorecard/schema";
import type { BrandTokens } from "~/lib/theme";
import { cn } from "~/lib/utils";
import { InspectorSection, LabeledField, TextAreaField, TextField } from "./fields";
import { useBuilder } from "./store";

const EMPTY_TIER_CONTENT: TierContent = { body: "", ctaLabel: "", ctaUrl: "", ctaText: "" };
const TOKENS = ["firstName", "lastName", "score", "tier", "constraint"] as const;

/** Patches the result page with an undo step (coalesced per field while typing). */
function useResultPagePatch() {
  const update = useBuilder((s) => s.update);
  return (fn: (rp: ResultPage) => ResultPage, coalesce?: string) =>
    update((doc) => ({ ...doc, resultPage: fn(doc.resultPage) }), coalesce ? { coalesce: `result:${coalesce}` } : undefined);
}

export function sortTiers(tiers: Tier[]): Tier[] {
  return [...tiers].sort((a, b) => a.min - b.min);
}

/** A synthetic score that lands in `tier`: the midpoint of its range, with every category at the same level. */
export function sampleScore(definition: Pick<Definition, "categories">, tier: Tier | null): ResultScore {
  const percent = tier ? Math.round((tier.min + tier.max) / 2) : 50;
  return {
    overallPercent: percent,
    tierId: tier?.id ?? null,
    categoryScores: definition.categories.map((c) => ({
      categoryId: c.id,
      name: c.name,
      points: percent,
      maxPoints: 100,
      percent,
      tierId: tier?.id ?? null,
    })),
  };
}

export const SAMPLE_LEAD = { firstName: "Alex", lastName: "Taylor" };

/** Sample Process Curve answers for the preview: a dip in the middle step, so the constraint shows. */
export function sampleAnswers(definition: Pick<Definition, "questions">): Answers {
  const answers: Answers = {};
  for (const q of definition.questions) {
    if (q.type !== "process_curve" || q.steps.length === 0) continue;
    const low = Math.floor((q.steps.length - 1) / 2);
    const high = Math.round(q.min + (q.max - q.min) * 0.8);
    answers[q.id] = {
      values: Object.fromEntries(q.steps.map((s, i) => [s.id, i === low ? q.min + 1 : high - (i % 2)])),
    };
  }
  return answers;
}

// ---------------------------------------------------------------------------
// Left pane: tiers + global settings
// ---------------------------------------------------------------------------

export function ResultSettingsPane({ scorecardId, tiers }: { scorecardId: string; tiers: Tier[] }) {
  const resultPage = useBuilder((s) => s.doc.resultPage);
  const hasCurves = useBuilder((s) => s.doc.questions.some((q) => q.type === "process_curve"));
  const selectedTierId = useBuilder((s) => s.selectedTierId);
  const selectTier = useBuilder((s) => s.selectTier);
  const patch = useResultPagePatch();
  const headlineRef = useRef<HTMLInputElement>(null);

  const insertToken = (token: string) => {
    const el = headlineRef.current;
    const text = `{{${token}}}`;
    const value = resultPage.headline;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    const next = value.slice(0, start) + text + value.slice(end);
    patch((rp) => ({ ...rp, headline: next }));
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + text.length, start + text.length);
    });
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="px-4 pb-2 pt-4">
        <h2 className="text-lg text-ink">Result Page</h2>
      </div>
      <InspectorSection
        title="Score tiers"
        action={
          <Link
            to={`/scorecards/${scorecardId}/settings/tiers`}
            className="flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline"
          >
            <Settings className="size-3.5" /> Edit tiers
          </Link>
        }
      >
        <p className="text-xs text-gray-500">Choose a tier to preview and edit its content.</p>
        {tiers.length === 0 ? (
          <p className="text-sm text-gray-700">No score tiers yet.</p>
        ) : (
          <ul className="space-y-1" role="listbox" aria-label="Score tiers">
            {tiers.map((t) => {
              const active = t.id === selectedTierId;
              return (
                <li key={t.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={active}
                    onClick={() => selectTier(t.id)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md border px-3 py-2 text-left text-sm",
                      active ? "border-brand-500 bg-brand-50/60" : "border-transparent hover:bg-gray-100",
                    )}
                  >
                    <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: t.color }} aria-hidden />
                    <span className={cn("flex-1 truncate", active ? "font-medium text-ink" : "text-gray-800")}>
                      {t.name || "Untitled tier"}
                    </span>
                    <span className="tabular-nums text-xs text-gray-500">
                      {t.min}–{t.max}%
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </InspectorSection>

      <InspectorSection title="Page settings">
        <LabeledField label="Headline">
          {(id) => (
            <TextField
              id={id}
              ref={headlineRef}
              value={resultPage.headline}
              placeholder="Your results, {{firstName}}"
              onChange={(e) => patch((rp) => ({ ...rp, headline: e.target.value }), "headline")}
            />
          )}
        </LabeledField>
        <div>
          <p className="mb-1.5 text-xs text-gray-500">Insert a personalised value:</p>
          <div className="flex flex-wrap gap-1">
            {TOKENS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => insertToken(t)}
                className="rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 font-mono text-[11px] text-gray-700 hover:border-brand-500 hover:text-brand-700"
              >
                {`{{${t}}}`}
              </button>
            ))}
          </div>
        </div>
        <div>
          <SwitchRow
            label="Show overall score"
            checked={resultPage.showOverallScore}
            onCheckedChange={(v) => patch((rp) => ({ ...rp, showOverallScore: v }))}
          />
          <SwitchRow
            label="Show category breakdown"
            checked={resultPage.showCategoryBreakdown}
            onCheckedChange={(v) => patch((rp) => ({ ...rp, showCategoryBreakdown: v }))}
          />
          {hasCurves && (
            <SwitchRow
              label="Show process curve charts"
              checked={resultPage.showProcessCurves}
              onCheckedChange={(v) => patch((rp) => ({ ...rp, showProcessCurves: v }))}
            />
          )}
        </div>
        <LabeledField label="Footer text">
          {(id) => (
            <TextAreaField
              id={id}
              rows={2}
              value={resultPage.footerText}
              placeholder="e.g. © Your Company"
              onChange={(e) => patch((rp) => ({ ...rp, footerText: e.target.value }), "footer")}
            />
          )}
        </LabeledField>
      </InspectorSection>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Right inspector: content for the selected tier
// ---------------------------------------------------------------------------

export function TierContentInspector({ tier }: { tier: Tier | null }) {
  const resultPage = useBuilder((s) => s.doc.resultPage);
  const categories = useBuilder((s) => s.doc.categories);
  const patch = useResultPagePatch();

  if (!tier) {
    return (
      <aside aria-label="Tier content" className="w-[320px] shrink-0 border-l border-gray-200 bg-white p-4 text-sm text-gray-600">
        Add score tiers to write tier-specific result content.
      </aside>
    );
  }

  const content = resultPage.tierContent[tier.id] ?? EMPTY_TIER_CONTENT;
  const setContent = (p: Partial<TierContent>, field: string) =>
    patch(
      (rp) => ({
        ...rp,
        tierContent: { ...rp.tierContent, [tier.id]: { ...EMPTY_TIER_CONTENT, ...rp.tierContent[tier.id], ...p } },
      }),
      `${tier.id}:${field}`,
    );
  const setCategoryHtml = (categoryId: string, html: string) =>
    patch(
      (rp) => ({
        ...rp,
        categoryContent: {
          ...rp.categoryContent,
          [categoryId]: { ...rp.categoryContent[categoryId], [tier.id]: html },
        },
      }),
      `${tier.id}:cat:${categoryId}`,
    );

  return (
    <aside aria-label="Tier content" className="flex w-[320px] shrink-0 flex-col border-l border-gray-200 bg-white">
      <div className="shrink-0 border-b border-gray-200 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Editing tier</p>
        <p className="mt-1 flex items-center gap-2 text-sm font-medium text-ink">
          <span className="size-2.5 rounded-full" style={{ backgroundColor: tier.color }} aria-hidden />
          {tier.name || "Untitled tier"}
          <span className="font-normal text-gray-500">
            ({tier.min}–{tier.max}%)
          </span>
        </p>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <InspectorSection title="Tier message">
          <RichTextEditor
            key={`body:${tier.id}`}
            label={`Message for ${tier.name}`}
            value={content.body}
            placeholder="What this result means and what to do next…"
            onChange={(html) => setContent({ body: html }, "body")}
          />
        </InspectorSection>

        <InspectorSection title="Call to action">
          <LabeledField label="Text">
            {(id) => (
              <TextAreaField
                id={id}
                rows={2}
                value={content.ctaText}
                placeholder="e.g. Want help improving your score?"
                onChange={(e) => setContent({ ctaText: e.target.value }, "ctaText")}
              />
            )}
          </LabeledField>
          <LabeledField label="Button label">
            {(id) => (
              <TextField
                id={id}
                value={content.ctaLabel}
                placeholder="e.g. Book a call"
                onChange={(e) => setContent({ ctaLabel: e.target.value }, "ctaLabel")}
              />
            )}
          </LabeledField>
          <LabeledField label="Button URL">
            {(id) => (
              <TextField
                id={id}
                type="url"
                value={content.ctaUrl}
                placeholder="https://"
                onChange={(e) => setContent({ ctaUrl: e.target.value }, "ctaUrl")}
              />
            )}
          </LabeledField>
        </InspectorSection>

        <InspectorSection title="Category feedback">
          {categories.length === 0 ? (
            <p className="text-sm text-gray-600">
              Add categories in the question builder to write feedback for each area.
            </p>
          ) : (
            categories.map((c) => (
              <div key={c.id} className="space-y-1.5">
                <p className="text-sm text-gray-800">{c.name || "Untitled category"}</p>
                <RichTextEditor
                  key={`cat:${c.id}:${tier.id}`}
                  label={`Feedback for ${c.name} in ${tier.name}`}
                  value={resultPage.categoryContent[c.id]?.[tier.id] ?? ""}
                  placeholder={`Feedback when ${c.name || "this category"} lands in ${tier.name}`}
                  minHeight={72}
                  onChange={(html) => setCategoryHtml(c.id, html)}
                />
              </div>
            ))
          )}
        </InspectorSection>
      </div>
    </aside>
  );
}

// ---------------------------------------------------------------------------
// Canvas
// ---------------------------------------------------------------------------

export function ResultCanvas({
  definition,
  theme,
  tier,
}: {
  definition: Definition;
  theme: BrandTokens;
  tier: Tier | null;
}) {
  return (
    <div className="h-full overflow-y-auto">
      <RespondentFrame theme={theme}>
        <ResultView
          definition={definition}
          theme={theme}
          score={sampleScore(definition, tier)}
          lead={SAMPLE_LEAD}
          answers={sampleAnswers(definition)}
        />
      </RespondentFrame>
    </div>
  );
}
