import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { newId } from "~/lib/scorecard/defaults";
import type { ProcessCurveStep, QuestionOfType } from "~/lib/scorecard/schema";
import { MAX_PROCESS_STEPS } from "~/lib/scorecard/validate";
import { InspectorSection, LabeledField, NumberField, RangeFields, SelectField, TextField } from "./fields";
import { useBuilder, useQuestionPatch } from "./store";

type Curve = QuestionOfType<"process_curve">;

/** Scale, points and label settings (shown in the main Question section). */
export function ProcessCurveSettings({ q }: { q: Curve }) {
  const patch = useQuestionPatch();
  const clampStarts = (min: number, max: number) =>
    q.steps.map((s) => ({ ...s, start: Math.min(max, Math.max(min, s.start)) }));
  return (
    <>
      <RangeFields
        label="Scale range"
        integer
        min={q.min}
        max={q.max}
        onMin={(v) => v != null && patch(q, { min: v, steps: clampStarts(v, q.max) })}
        onMax={(v) => v != null && patch(q, { max: v, steps: clampStarts(q.min, v) })}
      />
      <RangeFields
        label="Points range (per step)"
        integer
        nonNegative
        min={q.pointsMin}
        max={q.pointsMax}
        onMin={(v) => v != null && patch(q, { pointsMin: v })}
        onMax={(v) => v != null && patch(q, { pointsMax: v })}
      />
      <div className="grid grid-cols-2 gap-2">
        <LabeledField label="Top label">
          {(id) => <TextField id={id} value={q.topLabel} placeholder="+ Fast" onChange={(e) => patch(q, { topLabel: e.target.value }, "topLabel")} />}
        </LabeledField>
        <LabeledField label="Bottom label">
          {(id) => (
            <TextField id={id} value={q.bottomLabel} placeholder="– Slow" onChange={(e) => patch(q, { bottomLabel: e.target.value }, "bottomLabel")} />
          )}
        </LabeledField>
      </div>
      <LabeledField label="Constraint label" hint="Shown under the lowest step. Leave empty to hide the callout.">
        {(id) => (
          <TextField
            id={id}
            value={q.constraintLabel}
            placeholder="The constraint"
            onChange={(e) => patch(q, { constraintLabel: e.target.value }, "constraintLabel")}
          />
        )}
      </LabeledField>
    </>
  );
}

/** Step editor: label, category and starting value per step, left to right. */
export function ProcessCurveSteps({ q }: { q: Curve }) {
  const patch = useQuestionPatch();
  const categories = useBuilder((s) => s.doc.categories);
  const setStep = (id: string, p: Partial<ProcessCurveStep>, coalesce?: string) =>
    patch(q, { steps: q.steps.map((s) => (s.id === id ? { ...s, ...p } : s)) }, coalesce);
  const move = (index: number, by: -1 | 1) => {
    const steps = [...q.steps];
    [steps[index], steps[index + by]] = [steps[index + by], steps[index]];
    patch(q, { steps });
  };
  const mid = Math.round((q.min + q.max) / 2);

  return (
    <InspectorSection
      title="Steps (left to right)"
      action={
        <button
          type="button"
          aria-label="Add step"
          disabled={q.steps.length >= MAX_PROCESS_STEPS}
          onClick={() =>
            patch(q, {
              steps: [...q.steps, { id: newId("step"), label: `Step ${q.steps.length + 1}`, categoryId: null, start: mid }],
            })
          }
          className="grid size-7 place-items-center rounded-md border border-brand-600 text-brand-700 hover:bg-brand-50 disabled:opacity-40"
        >
          <Plus className="size-4" />
        </button>
      }
    >
      <p className="text-xs text-gray-500">
        For each step: its label, the category its points go to, and its starting value. Up to {MAX_PROCESS_STEPS} steps.
      </p>
      <ol className="space-y-3">
        {q.steps.map((s, i) => (
          <li key={s.id} className="space-y-1.5 rounded-md border border-gray-200 p-2.5">
            <div className="flex items-center gap-1">
              <TextField
                aria-label={`Step ${i + 1} label`}
                value={s.label}
                placeholder={`Step ${i + 1}`}
                onChange={(e) => setStep(s.id, { label: e.target.value }, `step-${s.id}-label`)}
              />
              <button
                type="button"
                aria-label={`Move step ${i + 1} left`}
                disabled={i === 0}
                onClick={() => move(i, -1)}
                className="grid size-7 shrink-0 place-items-center rounded text-gray-500 hover:bg-gray-100 disabled:opacity-30"
              >
                <ArrowUp className="size-3.5" />
              </button>
              <button
                type="button"
                aria-label={`Move step ${i + 1} right`}
                disabled={i === q.steps.length - 1}
                onClick={() => move(i, 1)}
                className="grid size-7 shrink-0 place-items-center rounded text-gray-500 hover:bg-gray-100 disabled:opacity-30"
              >
                <ArrowDown className="size-3.5" />
              </button>
              <button
                type="button"
                aria-label={`Remove step ${i + 1}`}
                disabled={q.steps.length <= 2}
                onClick={() => patch(q, { steps: q.steps.filter((x) => x.id !== s.id) })}
                className="grid size-7 shrink-0 place-items-center rounded text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
            <div className="grid grid-cols-[1fr_4.5rem] gap-1.5">
              <SelectField
                aria-label={`Step ${i + 1} category`}
                value={s.categoryId ?? ""}
                onChange={(e) => setStep(s.id, { categoryId: e.target.value || null })}
              >
                <option value="">No category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name || "Untitled category"}
                  </option>
                ))}
              </SelectField>
              <NumberField
                aria-label={`Step ${i + 1} starting value`}
                integer
                min={q.min}
                value={s.start}
                onChange={(v) => v != null && setStep(s.id, { start: v })}
                className="px-2"
              />
            </div>
          </li>
        ))}
      </ol>
      {categories.length === 0 && (
        <p className="text-xs text-gray-500">Add categories in the Categories panel to score steps separately.</p>
      )}
    </InspectorSection>
  );
}
