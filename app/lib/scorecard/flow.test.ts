import { describe, expect, it } from "vitest";
import { createDefaultDefinition, createQuestion } from "./defaults";
import { answerIssues, firstIncompleteIndex, pickKnownAnswers, progressPercent } from "./flow";
import type { Definition } from "./schema";

function def(): Definition {
  const d = createDefaultDefinition("X");
  d.questions = [
    { ...createQuestion("yes_no"), id: "q1", text: "One?" },
    { ...createQuestion("info"), id: "i1", text: "Info" },
    { ...createQuestion("open_text"), id: "q2", text: "Thoughts?", required: false },
    { ...createQuestion("choice_buttons"), id: "q3", text: "Pick" },
  ];
  return d;
}

describe("progressPercent", () => {
  it("ignores info screens", () => {
    const qs = def().questions;
    expect(progressPercent(qs, 0)).toBe(0);
    expect(progressPercent(qs, 1)).toBe(33);
    expect(progressPercent(qs, 2)).toBe(33);
    expect(progressPercent(qs, 3)).toBe(67);
    expect(progressPercent(qs, 4)).toBe(100);
    expect(progressPercent([], 0)).toBe(0);
  });
});

describe("answerIssues / firstIncompleteIndex", () => {
  it("reports unanswered required questions only", () => {
    const d = def();
    expect(answerIssues(d, {}).map((i) => i.questionId)).toEqual(["q1", "q3"]);
    expect(firstIncompleteIndex(d, {})).toBe(0);
    const opt = (d.questions[3] as { options: { id: string }[] }).options[0].id;
    const answers = { q1: { optionIds: ["yes"] }, q3: { optionIds: [opt] } };
    expect(answerIssues(d, answers)).toEqual([]);
    expect(firstIncompleteIndex(d, answers)).toBe(4);
    expect(firstIncompleteIndex(d, { q1: { optionIds: ["yes"] } })).toBe(3);
  });

  it("flags invalid stored answers", () => {
    expect(answerIssues(def(), { q1: { optionIds: ["nope"] } })[0]).toEqual({ questionId: "q1", message: "Invalid answer." });
  });
});

describe("pickKnownAnswers", () => {
  it("drops unknown and info answers", () => {
    expect(pickKnownAnswers(def(), { q1: { optionIds: ["yes"] }, i1: { text: "x" }, zz: { value: 1 } })).toEqual({
      q1: { optionIds: ["yes"] },
    });
  });
});
