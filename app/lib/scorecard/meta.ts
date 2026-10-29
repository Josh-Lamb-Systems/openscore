import type { QuestionType } from "./schema";

/** Display metadata for each question type, in the order shown in the "Add question" picker. */
export const QUESTION_TYPES: { type: QuestionType; label: string; description: string }[] = [
  { type: "yes_no", label: "Yes/No/Maybe", description: "Simple yes or no, with an optional maybe" },
  { type: "choice_buttons", label: "Multiple Choice Buttons", description: "Pick one option shown as buttons" },
  { type: "choice_checkbox", label: "Multiple Choice Checkboxes", description: "Pick any number of options" },
  { type: "choice_radio", label: "Multiple Choice Radio Button", description: "Pick one option from a list" },
  { type: "sliding_scale", label: "Sliding Scale", description: "Drag a slider across a range" },
  { type: "linear_scale", label: "Linear Scale", description: "Pick a number on a scale, e.g. 1–10" },
  { type: "divided_scale", label: "Divided Scale", description: "Pick one labelled segment of a scale" },
  { type: "numeric", label: "Numeric", description: "Enter a number, scored by ranges" },
  { type: "open_text", label: "Open Text", description: "Free-text answer (not scored)" },
  { type: "image_buttons", label: "Image Button", description: "Pick an option shown as an image" },
  { type: "info", label: "Info Screen", description: "Show content between questions (not scored)" },
  { type: "process_curve", label: "Process Curve", description: "Rate each step of a process and find the constraint" },
];

export function questionTypeLabel(type: QuestionType): string {
  return QUESTION_TYPES.find((t) => t.type === type)?.label ?? type;
}
