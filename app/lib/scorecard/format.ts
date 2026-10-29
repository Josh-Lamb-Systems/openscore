import { findConstraint, processCurveValues } from "~/lib/scoring/score";
import { isOptionQuestion, type Answer, type Question } from "./schema";

/**
 * Human-readable answer text, e.g. "Yes", "Option A, Option C", "7", "hello",
 * or for a Process Curve "Leads 7, Sales calls 6, Onboarding 2 (constraint: Onboarding)".
 */
export function formatAnswer(q: Question, answer: Answer | undefined): string {
  if (!answer) return "";
  if ("optionIds" in answer) {
    if (!isOptionQuestion(q)) return "";
    return answer.optionIds
      .map((id) => q.options.find((o) => o.id === id)?.label ?? id)
      .join(", ");
  }
  if ("value" in answer) {
    const unit = q.type === "numeric" && q.unit ? ` ${q.unit}` : "";
    return `${answer.value}${unit}`;
  }
  if ("values" in answer) {
    if (q.type !== "process_curve") return "";
    const values = processCurveValues(q, answer)!;
    const constraint = findConstraint(q, answer);
    const steps = q.steps.map((s) => `${s.label} ${values[s.id]}`).join(", ");
    return constraint ? `${steps} (constraint: ${constraint.label})` : steps;
  }
  return answer.text;
}
