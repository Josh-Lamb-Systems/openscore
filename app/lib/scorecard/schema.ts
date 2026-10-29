import { z } from "zod";

/**
 * The scorecard definition is the versioned, JSON-serialisable description of a
 * scorecard: questions, categories, tiers, result page, start screen and lead form.
 * It is stored as JSONB in `scorecards.draft_definition` and frozen into
 * `scorecard_versions.definition` on publish. Theme/brand settings are NOT part of
 * the definition (they live on the scorecard row and apply immediately).
 */

export const DEFINITION_SCHEMA_VERSION = 1;

const id = z.string().min(1);
const points = z.number().int().min(0);

export const mediaSchema = z.object({
  kind: z.enum(["image", "video"]),
  url: z.string(),
});

const questionBase = {
  id,
  text: z.string(),
  instruction: z.string().default(""),
  showInstruction: z.boolean().default(false),
  required: z.boolean().default(true),
  categoryId: z.string().nullable().default(null),
  media: mediaSchema.nullable().default(null),
};

export const choiceOptionSchema = z.object({
  id,
  label: z.string(),
  points,
  imageUrl: z.string().nullable().default(null),
});

export const scaleLabelsSchema = z.object({
  left: z.string().default(""),
  center: z.string().default(""),
  right: z.string().default(""),
});

export const yesNoQuestionSchema = z.object({
  ...questionBase,
  type: z.literal("yes_no"),
  showMaybe: z.boolean().default(false),
  randomize: z.boolean().default(false),
  /** Always exactly the ids "yes", "no", "maybe". */
  options: z.array(choiceOptionSchema),
});

export const choiceButtonsQuestionSchema = z.object({
  ...questionBase,
  type: z.literal("choice_buttons"),
  randomize: z.boolean().default(false),
  options: z.array(choiceOptionSchema),
});

export const choiceRadioQuestionSchema = z.object({
  ...questionBase,
  type: z.literal("choice_radio"),
  randomize: z.boolean().default(false),
  options: z.array(choiceOptionSchema),
});

export const choiceCheckboxQuestionSchema = z.object({
  ...questionBase,
  type: z.literal("choice_checkbox"),
  randomize: z.boolean().default(false),
  options: z.array(choiceOptionSchema),
  minSelections: z.number().int().min(0).nullable().default(null),
  maxSelections: z.number().int().min(1).nullable().default(null),
});

export const imageButtonsQuestionSchema = z.object({
  ...questionBase,
  type: z.literal("image_buttons"),
  randomize: z.boolean().default(false),
  multiSelect: z.boolean().default(false),
  options: z.array(choiceOptionSchema),
});

export const slidingScaleQuestionSchema = z.object({
  ...questionBase,
  type: z.literal("sliding_scale"),
  min: z.number(),
  max: z.number(),
  step: z.number().positive(),
  start: z.number(),
  pointsMin: points,
  pointsMax: points,
  labels: scaleLabelsSchema,
});

export const linearScaleQuestionSchema = z.object({
  ...questionBase,
  type: z.literal("linear_scale"),
  min: z.number().int(),
  max: z.number().int(),
  start: z.number().int().nullable().default(null),
  pointsMin: points,
  pointsMax: points,
  labels: scaleLabelsSchema,
});

export const dividedScaleQuestionSchema = z.object({
  ...questionBase,
  type: z.literal("divided_scale"),
  /** Ordered left → right. */
  options: z.array(choiceOptionSchema),
});

export const numericRangeSchema = z.object({
  id,
  /** Inclusive bounds; null = unbounded. */
  min: z.number().nullable(),
  max: z.number().nullable(),
  points,
});

export const numericQuestionSchema = z.object({
  ...questionBase,
  type: z.literal("numeric"),
  min: z.number().nullable().default(null),
  max: z.number().nullable().default(null),
  unit: z.string().default(""),
  ranges: z.array(numericRangeSchema),
});

export const openTextQuestionSchema = z.object({
  ...questionBase,
  type: z.literal("open_text"),
  multiline: z.boolean().default(false),
  placeholder: z.string().default(""),
});

export const infoScreenQuestionSchema = z.object({
  ...questionBase,
  type: z.literal("info"),
  /** Rich text (sanitised HTML). */
  body: z.string().default(""),
  buttonLabel: z.string().default("Continue"),
});

export const processCurveStepSchema = z.object({
  id,
  label: z.string(),
  /** Points for this step go to this category (the question-level categoryId is ignored). */
  categoryId: z.string().nullable().default(null),
  start: z.number().int(),
});

/**
 * "Find the constraint" chart: the respondent rates how fast each step of a
 * process moves; the lowest step is the constraint. See docs/SPEC.md §4.1.
 */
export const processCurveQuestionSchema = z.object({
  ...questionBase,
  type: z.literal("process_curve"),
  steps: z.array(processCurveStepSchema),
  min: z.number().int(),
  max: z.number().int(),
  pointsMin: points,
  pointsMax: points,
  topLabel: z.string().default("+ Fast"),
  bottomLabel: z.string().default("– Slow"),
  constraintLabel: z.string().default("The constraint"),
});

export const questionSchema = z.discriminatedUnion("type", [
  yesNoQuestionSchema,
  choiceButtonsQuestionSchema,
  choiceRadioQuestionSchema,
  choiceCheckboxQuestionSchema,
  imageButtonsQuestionSchema,
  slidingScaleQuestionSchema,
  linearScaleQuestionSchema,
  dividedScaleQuestionSchema,
  numericQuestionSchema,
  openTextQuestionSchema,
  infoScreenQuestionSchema,
  processCurveQuestionSchema,
]);

export const categorySchema = z.object({
  id,
  name: z.string(),
  description: z.string().default(""),
});

export const tierSchema = z.object({
  id,
  name: z.string(),
  /** Inclusive integer percentage bounds, 0–100. */
  min: z.number().int().min(0).max(100),
  max: z.number().int().min(0).max(100),
  color: z.string().default("#0D9488"),
});

export const leadFieldSchema = z.object({
  id,
  /** Built-in fields use fixed keys; custom fields use `custom_<id>`. */
  key: z.string(),
  label: z.string(),
  type: z.enum(["text", "email", "phone", "select", "checkbox"]),
  required: z.boolean(),
  enabled: z.boolean().default(true),
  builtIn: z.boolean().default(false),
  options: z.array(z.string()).default([]),
});

export const leadFormSchema = z.object({
  enabled: z.boolean().default(true),
  position: z.enum(["before", "after"]).default("before"),
  title: z.string().default("Enter your details below to start the scorecard"),
  submitLabel: z.string().default("Start"),
  fields: z.array(leadFieldSchema),
  consent: z.object({
    mode: z.enum(["implied", "explicit_optional", "explicit_required"]).default("implied"),
    label: z.string().default("I agree to receive communications"),
    privacyStatement: z.string().default(""),
    privacyUrl: z.string().default(""),
  }),
});

export const startScreenSchema = z.object({
  title: z.string(),
  subtitle: z.string().default(""),
  description: z.string().default(""),
  bullets: z.array(z.string()).default([]),
  buttonLabel: z.string().default("Start"),
  imageUrl: z.string().nullable().default(null),
});

export const tierContentSchema = z.object({
  /** Rich text (sanitised HTML). */
  body: z.string().default(""),
  ctaLabel: z.string().default(""),
  ctaUrl: z.string().default(""),
  ctaText: z.string().default(""),
});

export const resultPageSchema = z.object({
  /** Supports {{firstName}}, {{lastName}}, {{score}}, {{tier}}. */
  headline: z.string().default("Your results, {{firstName}}"),
  showOverallScore: z.boolean().default(true),
  showCategoryBreakdown: z.boolean().default(true),
  /** Keyed by tier id. */
  tierContent: z.record(z.string(), tierContentSchema).default({}),
  /** Keyed by category id, then tier id → rich text (sanitised HTML). */
  categoryContent: z.record(z.string(), z.record(z.string(), z.string())).default({}),
  footerText: z.string().default(""),
  /** Show the respondent's chart for each answered Process Curve question. */
  showProcessCurves: z.boolean().default(true),
});

export const definitionSchema = z.object({
  schemaVersion: z.literal(DEFINITION_SCHEMA_VERSION),
  startScreen: startScreenSchema,
  leadForm: leadFormSchema,
  categories: z.array(categorySchema),
  questions: z.array(questionSchema),
  tiers: z.array(tierSchema),
  resultPage: resultPageSchema,
});

export type Definition = z.infer<typeof definitionSchema>;
export type Question = z.infer<typeof questionSchema>;
export type QuestionType = Question["type"];
export type ChoiceOption = z.infer<typeof choiceOptionSchema>;
export type NumericRange = z.infer<typeof numericRangeSchema>;
export type ProcessCurveStep = z.infer<typeof processCurveStepSchema>;
export type ProcessCurveQuestion = z.infer<typeof processCurveQuestionSchema>;
export type Category = z.infer<typeof categorySchema>;
export type Tier = z.infer<typeof tierSchema>;
export type LeadField = z.infer<typeof leadFieldSchema>;
export type LeadForm = z.infer<typeof leadFormSchema>;
export type StartScreen = z.infer<typeof startScreenSchema>;
export type ResultPage = z.infer<typeof resultPageSchema>;
export type TierContent = z.infer<typeof tierContentSchema>;

export type QuestionOfType<T extends QuestionType> = Extract<Question, { type: T }>;

/** Question types whose answer is a set of option ids. */
export const OPTION_QUESTION_TYPES = [
  "yes_no",
  "choice_buttons",
  "choice_radio",
  "choice_checkbox",
  "image_buttons",
  "divided_scale",
] as const satisfies readonly QuestionType[];

export type OptionQuestion = QuestionOfType<(typeof OPTION_QUESTION_TYPES)[number]>;

export function isOptionQuestion(q: Question): q is OptionQuestion {
  return (OPTION_QUESTION_TYPES as readonly string[]).includes(q.type);
}

/** Questions that never contribute to scores. */
export function isScoredQuestion(q: Question): boolean {
  return q.type !== "open_text" && q.type !== "info";
}

// ---------------------------------------------------------------------------
// Answers
// ---------------------------------------------------------------------------

export const answerSchema = z.union([
  z.object({ optionIds: z.array(z.string()) }),
  z.object({ value: z.number() }),
  z.object({ text: z.string() }),
  /** Process Curve: value per step id. */
  z.object({ values: z.record(z.string(), z.number()) }),
]);

export type Answer = z.infer<typeof answerSchema>;
/** Keyed by question id. */
export type Answers = Record<string, Answer>;

export const answersSchema = z.record(z.string(), answerSchema);
