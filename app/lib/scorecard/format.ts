import { isOptionQuestion, type Answer, type Question } from "./schema";

/** Human-readable answer text, e.g. "Yes", "Option A, Option C", "7", "hello". */
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
  return answer.text;
}
