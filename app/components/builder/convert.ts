import { createQuestion, newId } from "~/lib/scorecard/defaults";
import type { ChoiceOption, Question, QuestionType } from "~/lib/scorecard/schema";

/** Types whose options are free-form and can be carried over when switching between them. */
const FREE_OPTION_TYPES: QuestionType[] = [
  "choice_buttons",
  "choice_radio",
  "choice_checkbox",
  "image_buttons",
  "divided_scale",
];

/**
 * Converts a question to another type, keeping its identity and common settings
 * (id, text, instruction, required, category, media). Answer options are kept
 * when moving between free-form choice types; everything else uses the new
 * type's defaults.
 */
export function convertQuestion(q: Question, type: QuestionType): Question {
  if (q.type === type) return q;
  const fresh = createQuestion(type);
  const next = {
    ...fresh,
    id: q.id,
    text: q.text,
    instruction: q.instruction,
    showInstruction: q.showInstruction,
    required: type === "info" ? false : q.required,
    categoryId: q.categoryId,
    media: q.media,
  } as Question;

  if (FREE_OPTION_TYPES.includes(q.type) && FREE_OPTION_TYPES.includes(type) && "options" in q && "options" in next) {
    (next as { options: ChoiceOption[] }).options = q.options.map((o) => ({ ...o }));
    if ("randomize" in q && "randomize" in next) (next as { randomize: boolean }).randomize = q.randomize;
  }
  return next;
}

/** Deep copy with fresh ids for the question and its options/ranges. */
export function duplicateQuestion(q: Question): Question {
  const copy = structuredClone(q);
  copy.id = newId("q");
  if ("options" in copy && copy.type !== "yes_no") {
    copy.options = copy.options.map((o) => ({ ...o, id: newId("opt") }));
  }
  if (copy.type === "numeric") {
    copy.ranges = copy.ranges.map((r) => ({ ...r, id: newId("rng") }));
  }
  return copy;
}
