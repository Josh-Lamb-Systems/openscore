import {
  isOptionQuestion,
  isScoredQuestion,
  type Answer,
  type Answers,
  type Definition,
  type OptionQuestion,
  type ProcessCurveQuestion,
  type ProcessCurveStep,
  type Question,
  type Tier,
} from "~/lib/scorecard/schema";

/**
 * Scoring engine. Pure and deterministic: the same definition + answers always
 * produce the same result. Used by the server at completion time and by the
 * builder preview.
 *
 * Rules (see docs/SPEC.md §5):
 * - Each scored question contributes to the overall score and, if it has a
 *   categoryId, to that category.
 * - Unanswered questions score 0 but still count toward the maximum.
 * - percent = round(100 × points / maxPoints); 0 when maxPoints is 0.
 * - Tiers are inclusive integer ranges over the percent.
 */

export interface ScoreTotals {
  points: number;
  maxPoints: number;
  percent: number;
}

export interface CategoryScore extends ScoreTotals {
  categoryId: string;
  name: string;
  tierId: string | null;
}

export interface ScoreResult {
  overall: ScoreTotals;
  tierId: string | null;
  categories: CategoryScore[];
  /** Keyed by question id; only scored questions are present. */
  questions: Record<string, { points: number; maxPoints: number }>;
}

/** Options that are actually selectable (yes/no hides "maybe" unless enabled). */
export function visibleOptions(q: OptionQuestion) {
  if (q.type === "yes_no" && !q.showMaybe) {
    return q.options.filter((o) => o.id !== "maybe");
  }
  return q.options;
}

export function isMultiSelect(q: Question): boolean {
  return q.type === "choice_checkbox" || (q.type === "image_buttons" && q.multiSelect);
}

function sumTopN(values: number[], n: number | null): number {
  const sorted = values.filter((v) => v > 0).sort((a, b) => b - a);
  return (n == null ? sorted : sorted.slice(0, n)).reduce((a, b) => a + b, 0);
}

export function questionMaxPoints(q: Question): number {
  if (!isScoredQuestion(q)) return 0;
  if (isOptionQuestion(q)) {
    const pts = visibleOptions(q).map((o) => o.points);
    if (pts.length === 0) return 0;
    if (isMultiSelect(q)) {
      return sumTopN(pts, q.type === "choice_checkbox" ? q.maxSelections : null);
    }
    return Math.max(0, ...pts);
  }
  switch (q.type) {
    case "sliding_scale":
    case "linear_scale":
      return Math.max(q.pointsMin, q.pointsMax);
    case "numeric":
      return Math.max(0, ...q.ranges.map((r) => r.points));
    case "process_curve":
      return q.steps.length * Math.max(q.pointsMin, q.pointsMax);
    default:
      return 0;
  }
}

/** Linear map of a scale value onto [pointsMin, pointsMax]. */
export function scalePoints(
  q: { min: number; max: number; pointsMin: number; pointsMax: number },
  value: number,
): number {
  if (q.max === q.min) return q.pointsMax;
  const v = Math.min(Math.max(value, Math.min(q.min, q.max)), Math.max(q.min, q.max));
  const t = (v - q.min) / (q.max - q.min);
  return q.pointsMin + t * (q.pointsMax - q.pointsMin);
}

export function numericPoints(q: Extract<Question, { type: "numeric" }>, value: number): number {
  const range = q.ranges.find(
    (r) => (r.min == null || value >= r.min) && (r.max == null || value <= r.max),
  );
  return range?.points ?? 0;
}

/**
 * A Process Curve answer's value for each step: the answered value, or the
 * step's starting value when the answer doesn't include it. Null when unanswered.
 */
export function processCurveValues(
  q: ProcessCurveQuestion,
  answer: Answer | undefined,
): Record<string, number> | null {
  if (!answer || !("values" in answer)) return null;
  return Object.fromEntries(
    q.steps.map((step) => {
      const v = answer.values[step.id];
      return [step.id, typeof v === "number" && Number.isFinite(v) ? v : step.start];
    }),
  );
}

/** The constraint: the step with the lowest value; ties go to the first (leftmost) step. */
export function findConstraint(q: ProcessCurveQuestion, answer: Answer | undefined): ProcessCurveStep | null {
  const values = processCurveValues(q, answer);
  if (!values || q.steps.length === 0) return null;
  return q.steps.reduce((lowest, step) => (values[step.id] < values[lowest.id] ? step : lowest));
}

/**
 * How a question's points split across categories. Most questions contribute one
 * entry (their own category); a Process Curve contributes one entry per step.
 */
export function questionContributions(
  q: Question,
  answer: Answer | undefined,
): { categoryId: string | null; points: number; maxPoints: number }[] {
  if (!isScoredQuestion(q)) return [];
  if (q.type === "process_curve") {
    const values = processCurveValues(q, answer);
    const stepMax = Math.max(q.pointsMin, q.pointsMax);
    return q.steps.map((step) => ({
      categoryId: step.categoryId,
      points: values ? Math.min(Math.max(scalePoints(q, values[step.id]), 0), stepMax) : 0,
      maxPoints: stepMax,
    }));
  }
  return [{ categoryId: q.categoryId, points: questionPoints(q, answer), maxPoints: questionMaxPoints(q) }];
}

export function questionPoints(q: Question, answer: Answer | undefined): number {
  if (!answer || !isScoredQuestion(q)) return 0;
  if (q.type === "process_curve") {
    return questionContributions(q, answer).reduce((sum, c) => sum + c.points, 0);
  }
  const max = questionMaxPoints(q);
  let pts = 0;

  if (isOptionQuestion(q)) {
    if (!("optionIds" in answer)) return 0;
    const opts = visibleOptions(q);
    const selected = answer.optionIds
      .map((id) => opts.find((o) => o.id === id))
      .filter((o): o is NonNullable<typeof o> => o != null);
    if (isMultiSelect(q)) {
      const unique = [...new Map(selected.map((o) => [o.id, o])).values()];
      pts = unique.reduce((sum, o) => sum + o.points, 0);
    } else {
      pts = selected[0]?.points ?? 0;
    }
  } else if ("value" in answer && Number.isFinite(answer.value)) {
    if (q.type === "sliding_scale" || q.type === "linear_scale") {
      pts = scalePoints(q, answer.value);
    } else if (q.type === "numeric") {
      pts = numericPoints(q, answer.value);
    }
  }

  return Math.min(Math.max(pts, 0), max);
}

export function percentOf(points: number, maxPoints: number): number {
  if (maxPoints <= 0) return 0;
  return Math.round((100 * points) / maxPoints);
}

export function tierForPercent(tiers: Tier[], percent: number): Tier | null {
  return tiers.find((t) => percent >= t.min && percent <= t.max) ?? null;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** The constraint of the first answered Process Curve in the definition (drives `{{constraint}}`). */
export function firstConstraint(definition: Definition, answers: Answers): ProcessCurveStep | null {
  for (const q of definition.questions) {
    if (q.type !== "process_curve") continue;
    const step = findConstraint(q, answers[q.id]);
    if (step) return step;
  }
  return null;
}

export function scoreResponse(definition: Definition, answers: Answers): ScoreResult {
  const questions: ScoreResult["questions"] = {};
  const byCategory = new Map<string, { points: number; maxPoints: number }>();
  let points = 0;
  let maxPoints = 0;

  for (const q of definition.questions) {
    if (!isScoredQuestion(q)) continue;
    let qPts = 0;
    let qMax = 0;
    for (const part of questionContributions(q, answers[q.id])) {
      qPts += part.points;
      qMax += part.maxPoints;
      if (part.categoryId) {
        const c = byCategory.get(part.categoryId) ?? { points: 0, maxPoints: 0 };
        c.points += part.points;
        c.maxPoints += part.maxPoints;
        byCategory.set(part.categoryId, c);
      }
    }
    questions[q.id] = { points: round2(qPts), maxPoints: qMax };
    points += qPts;
    maxPoints += qMax;
  }

  const overallPercent = percentOf(points, maxPoints);
  const categories: CategoryScore[] = definition.categories
    .filter((c) => (byCategory.get(c.id)?.maxPoints ?? 0) > 0)
    .map((c) => {
      const totals = byCategory.get(c.id)!;
      const percent = percentOf(totals.points, totals.maxPoints);
      return {
        categoryId: c.id,
        name: c.name,
        points: round2(totals.points),
        maxPoints: totals.maxPoints,
        percent,
        tierId: tierForPercent(definition.tiers, percent)?.id ?? null,
      };
    });

  return {
    overall: { points: round2(points), maxPoints, percent: overallPercent },
    tierId: tierForPercent(definition.tiers, overallPercent)?.id ?? null,
    categories,
    questions,
  };
}
