import { isMultiSelect, visibleOptions } from "~/lib/scoring/score";
import {
  definitionSchema,
  isOptionQuestion,
  type Answer,
  type Definition,
  type LeadForm,
  type Question,
  type Tier,
} from "./schema";

export const MAX_PROCESS_STEPS = 7;

export interface ValidationIssue {
  /** Where the problem is, e.g. "questions.q_abc" or "tiers". Used to link to the editor. */
  path: string;
  message: string;
}

export function validateTiers(tiers: Tier[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (tiers.length === 0) {
    return [{ path: "tiers", message: "Add at least one score tier." }];
  }
  const sorted = [...tiers].sort((a, b) => a.min - b.min);
  sorted.forEach((t, i) => {
    if (!t.name.trim()) issues.push({ path: `tiers.${t.id}`, message: "Every tier needs a name." });
    if (t.min > t.max) {
      issues.push({ path: `tiers.${t.id}`, message: `"${t.name}" starts after it ends.` });
    }
    if (i === 0 && t.min !== 0) {
      issues.push({ path: `tiers.${t.id}`, message: "The lowest tier must start at 0%." });
    }
    if (i === sorted.length - 1 && t.max !== 100) {
      issues.push({ path: `tiers.${t.id}`, message: "The highest tier must end at 100%." });
    }
    const next = sorted[i + 1];
    if (next && next.min !== t.max + 1) {
      issues.push({
        path: `tiers.${next.id}`,
        message:
          next.min <= t.max
            ? `"${t.name}" and "${next.name}" overlap.`
            : `There is a gap between "${t.name}" (ends ${t.max}%) and "${next.name}" (starts ${next.min}%).`,
      });
    }
  });
  return issues;
}

export function validateQuestion(q: Question, categoryIds: Set<string>): string[] {
  const errors: string[] = [];
  if (q.type === "info") {
    if (!q.text.trim() && !q.body.replace(/<[^>]*>/g, "").trim()) errors.push("Add a heading or some content.");
  } else if (!q.text.trim()) {
    errors.push("Write your question.");
  }
  if (q.categoryId && !categoryIds.has(q.categoryId)) errors.push("The selected category no longer exists.");

  if (isOptionQuestion(q)) {
    const opts = visibleOptions(q);
    if (opts.length < 2) errors.push("Add at least two answers.");
    if (opts.some((o) => !o.label.trim())) errors.push("Every answer needs a label.");
    if (q.type === "image_buttons" && opts.some((o) => !o.imageUrl)) {
      errors.push("Every image answer needs an image.");
    }
    if (q.type === "choice_checkbox") {
      if (q.minSelections != null && q.maxSelections != null && q.minSelections > q.maxSelections) {
        errors.push("Minimum selections cannot exceed maximum selections.");
      }
      if (q.maxSelections != null && q.maxSelections > opts.length) {
        errors.push("Maximum selections cannot exceed the number of answers.");
      }
    }
  }

  switch (q.type) {
    case "sliding_scale":
      if (q.min >= q.max) errors.push("The scale minimum must be lower than the maximum.");
      if (q.step <= 0) errors.push("The step must be greater than 0.");
      if (q.start < q.min || q.start > q.max) errors.push("The starting value must be inside the scale.");
      break;
    case "linear_scale":
      if (q.min >= q.max) errors.push("The scale minimum must be lower than the maximum.");
      if (q.max - q.min > 20) errors.push("A linear scale can have at most 21 points.");
      if (q.start != null && (q.start < q.min || q.start > q.max)) {
        errors.push("The starting value must be inside the scale.");
      }
      break;
    case "numeric":
      if (q.min != null && q.max != null && q.min > q.max) {
        errors.push("The minimum must be lower than the maximum.");
      }
      if (q.ranges.length === 0) errors.push("Add at least one scoring range.");
      if (q.ranges.some((r) => r.min != null && r.max != null && r.min > r.max)) {
        errors.push("A scoring range starts after it ends.");
      }
      break;
    case "process_curve":
      if (q.steps.length < 2) errors.push("Add at least two steps.");
      if (q.steps.length > MAX_PROCESS_STEPS) errors.push(`Use at most ${MAX_PROCESS_STEPS} steps.`);
      if (q.steps.some((s) => !s.label.trim())) errors.push("Every step needs a label.");
      if (q.min >= q.max) errors.push("The scale minimum must be lower than the maximum.");
      if (q.steps.some((s) => s.start < q.min || s.start > q.max)) {
        errors.push("Every starting value must be inside the scale.");
      }
      if (q.steps.some((s) => s.categoryId && !categoryIds.has(s.categoryId))) {
        errors.push("A step's category no longer exists.");
      }
      break;
  }
  return errors;
}

export function validateLeadForm(form: LeadForm): ValidationIssue[] {
  if (!form.enabled) return [];
  const issues: ValidationIssue[] = [];
  const enabled = form.fields.filter((f) => f.enabled);
  if (enabled.length === 0) {
    issues.push({ path: "leadForm", message: "Enable at least one lead form field, or turn the lead form off." });
  }
  for (const f of enabled) {
    if (!f.label.trim()) issues.push({ path: `leadForm.${f.id}`, message: "Every lead form field needs a label." });
    if (f.type === "select" && f.options.filter((o) => o.trim()).length === 0) {
      issues.push({ path: `leadForm.${f.id}`, message: `"${f.label}" needs at least one option.` });
    }
  }
  if (form.consent.mode !== "implied" && !form.consent.label.trim()) {
    issues.push({ path: "leadForm.consent", message: "The consent checkbox needs a label." });
  }
  return issues;
}

/** Everything that must be true before a draft can be published. */
export function validateForPublish(input: unknown): ValidationIssue[] {
  const parsed = definitionSchema.safeParse(input);
  if (!parsed.success) {
    return parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message }));
  }
  const def: Definition = parsed.data;
  const issues: ValidationIssue[] = [];
  const categoryIds = new Set(def.categories.map((c) => c.id));

  if (!def.startScreen.title.trim()) {
    issues.push({ path: "startScreen", message: "The start screen needs a title." });
  }
  if (def.questions.filter((q) => q.type !== "info").length === 0) {
    issues.push({ path: "questions", message: "Add at least one question." });
  }
  def.questions.forEach((q, i) => {
    for (const message of validateQuestion(q, categoryIds)) {
      issues.push({ path: `questions.${q.id}`, message: `Question ${i + 1}: ${message}` });
    }
  });
  if (def.categories.some((c) => !c.name.trim())) {
    issues.push({ path: "categories", message: "Every category needs a name." });
  }
  issues.push(...validateTiers(def.tiers));
  issues.push(...validateLeadForm(def.leadForm));
  return issues;
}

/** Validates a single respondent answer. Returns an error message or null. */
export function validateAnswer(q: Question, answer: Answer | undefined): string | null {
  const empty =
    !answer ||
    ("optionIds" in answer && answer.optionIds.length === 0) ||
    ("text" in answer && !answer.text.trim()) ||
    ("value" in answer && !Number.isFinite(answer.value)) ||
    ("values" in answer && Object.keys(answer.values).length === 0);

  if (q.type === "info") return null;
  if (empty) {
    if (!q.required) return null;
    // The curve's answer is only created once a point is moved, so "required" means "move at least one".
    return q.type === "process_curve" ? "Drag at least one point to answer." : "This question is required.";
  }

  if (isOptionQuestion(q)) {
    if (!("optionIds" in answer)) return "Invalid answer.";
    const ids = new Set(visibleOptions(q).map((o) => o.id));
    if (answer.optionIds.some((id) => !ids.has(id))) return "Invalid answer.";
    if (!isMultiSelect(q) && answer.optionIds.length > 1) return "Choose only one answer.";
    if (q.type === "choice_checkbox") {
      const n = new Set(answer.optionIds).size;
      if (q.minSelections != null && n < q.minSelections) return `Choose at least ${q.minSelections}.`;
      if (q.maxSelections != null && n > q.maxSelections) return `Choose at most ${q.maxSelections}.`;
    }
    return null;
  }

  switch (q.type) {
    case "open_text":
      return "text" in answer ? null : "Invalid answer.";
    case "sliding_scale":
    case "linear_scale":
      if (!("value" in answer)) return "Invalid answer.";
      if (answer.value < q.min || answer.value > q.max) return "Value is out of range.";
      if (q.type === "linear_scale" && !Number.isInteger(answer.value)) return "Invalid answer.";
      return null;
    case "numeric":
      if (!("value" in answer)) return "Enter a number.";
      if (q.min != null && answer.value < q.min) return `Enter a number of at least ${q.min}.`;
      if (q.max != null && answer.value > q.max) return `Enter a number no greater than ${q.max}.`;
      return null;
    case "process_curve": {
      if (!("values" in answer)) return "Invalid answer.";
      const stepIds = new Set(q.steps.map((s) => s.id));
      for (const [stepId, v] of Object.entries(answer.values)) {
        if (!stepIds.has(stepId) || !Number.isInteger(v) || v < q.min || v > q.max) return "Invalid answer.";
      }
      return null;
    }
  }
  return null;
}
