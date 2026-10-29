import type { Answers, Definition, Question } from "./schema";
import { validateAnswer } from "./validate";

/**
 * Pure helpers for the respondent flow, shared by the public pages and
 * `/api/respond`.
 */

/** Progress through the questions; info screens are not counted (docs/SPEC.md §4). */
export function progressPercent(questions: Question[], index: number): number {
  const counted = questions.filter((q) => q.type !== "info");
  if (counted.length === 0) return 0;
  const done = questions.slice(0, Math.max(0, index)).filter((q) => q.type !== "info").length;
  return Math.round((100 * Math.min(done, counted.length)) / counted.length);
}

/** Questions whose stored answer is missing or invalid (required ones only report "missing"). */
export function answerIssues(definition: Definition, answers: Answers): { questionId: string; message: string }[] {
  const issues: { questionId: string; message: string }[] = [];
  for (const q of definition.questions) {
    const message = validateAnswer(q, answers[q.id]);
    if (message) issues.push({ questionId: q.id, message });
  }
  return issues;
}

/** Index of the first question that still needs an answer, or the number of questions when all are done. */
export function firstIncompleteIndex(definition: Definition, answers: Answers): number {
  const i = definition.questions.findIndex((q) => q.type !== "info" && validateAnswer(q, answers[q.id]) !== null);
  return i === -1 ? definition.questions.length : i;
}

/** Drops answers to questions that don't exist (or are info screens) in the definition. */
export function pickKnownAnswers(definition: Definition, answers: Answers): Answers {
  const known = new Set(definition.questions.filter((q) => q.type !== "info").map((q) => q.id));
  return Object.fromEntries(Object.entries(answers).filter(([id]) => known.has(id)));
}
