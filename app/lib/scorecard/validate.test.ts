import { describe, expect, it } from "vitest";
import { createDefaultDefinition, createQuestion } from "./defaults";
import type { Tier } from "./schema";
import { validateAnswer, validateForPublish, validateQuestion, validateTiers } from "./validate";

const tier = (id: string, min: number, max: number): Tier => ({ id, name: id, min, max, color: "" });

describe("validateTiers", () => {
  it("accepts contiguous tiers covering 0–100 in any order", () => {
    expect(validateTiers([tier("b", 51, 100), tier("a", 0, 50)])).toEqual([]);
  });

  it("reports gaps, overlaps and bad bounds", () => {
    expect(validateTiers([])).toHaveLength(1);
    expect(validateTiers([tier("a", 5, 100)])[0].message).toMatch(/start at 0/);
    expect(validateTiers([tier("a", 0, 99)])[0].message).toMatch(/end at 100/);
    expect(validateTiers([tier("a", 0, 50), tier("b", 52, 100)])[0].message).toMatch(/gap/);
    expect(validateTiers([tier("a", 0, 50), tier("b", 50, 100)])[0].message).toMatch(/overlap/);
  });
});

describe("validateForPublish", () => {
  it("requires at least one question", () => {
    const issues = validateForPublish(createDefaultDefinition("X"));
    expect(issues.map((i) => i.path)).toContain("questions");
  });

  it("passes a minimal valid scorecard", () => {
    const def = createDefaultDefinition("X");
    def.questions = [{ ...createQuestion("yes_no"), text: "Ready?" }];
    expect(validateForPublish(def)).toEqual([]);
  });

  it("flags empty question text and unknown categories", () => {
    const def = createDefaultDefinition("X");
    def.questions = [{ ...createQuestion("choice_buttons"), categoryId: "gone" }];
    const messages = validateForPublish(def).map((i) => i.message);
    expect(messages.some((m) => m.includes("Write your question"))).toBe(true);
    expect(messages.some((m) => m.includes("category"))).toBe(true);
  });

  it("lets info screens omit the heading when they have content", () => {
    const def = createDefaultDefinition("X");
    const info = createQuestion("info");
    def.questions = [
      { ...createQuestion("yes_no"), text: "Ready?" },
      info.type === "info" ? { ...info, body: "<p>Hi</p>" } : info,
    ];
    expect(validateForPublish(def)).toEqual([]);
    def.questions[1] = info;
    expect(validateForPublish(def).map((i) => i.message).join()).toMatch(/heading or some content/);
  });

  it("rejects malformed input", () => {
    expect(validateForPublish({ nope: true }).length).toBeGreaterThan(0);
  });
});

describe("validateAnswer", () => {
  it("enforces required", () => {
    const q = { ...createQuestion("yes_no"), text: "?" };
    expect(validateAnswer(q, undefined)).toMatch(/required/);
    expect(validateAnswer({ ...q, required: false }, undefined)).toBeNull();
  });

  it("rejects hidden or unknown options and multiple picks on single-select", () => {
    const q = createQuestion("yes_no");
    expect(validateAnswer(q, { optionIds: ["maybe"] })).toBeTruthy();
    expect(validateAnswer(q, { optionIds: ["yes", "no"] })).toBeTruthy();
    expect(validateAnswer(q, { optionIds: ["yes"] })).toBeNull();
  });

  it("checks checkbox min/max selections", () => {
    const q = { ...createQuestion("choice_checkbox"), minSelections: 2, maxSelections: 2 };
    const ids = q.type === "choice_checkbox" ? q.options.map((o) => o.id) : [];
    expect(validateAnswer(q, { optionIds: ids.slice(0, 1) })).toMatch(/at least/);
    expect(validateAnswer(q, { optionIds: ids })).toMatch(/at most/);
    expect(validateAnswer(q, { optionIds: ids.slice(0, 2) })).toBeNull();
  });

  it("checks scale and numeric bounds", () => {
    expect(validateAnswer(createQuestion("linear_scale"), { value: 11 })).toBeTruthy();
    expect(validateAnswer(createQuestion("linear_scale"), { value: 2.5 })).toBeTruthy();
    expect(validateAnswer(createQuestion("numeric"), { value: -1 })).toMatch(/at least/);
  });
});

describe("process curve validation", () => {
  const curve = () => {
    const q = createQuestion("process_curve");
    if (q.type !== "process_curve") throw new Error("unreachable");
    return { ...q, text: "Where are you slow?" };
  };

  it("accepts the default curve", () => {
    expect(validateQuestion(curve(), new Set())).toEqual([]);
  });

  it("flags too few or too many steps, blank labels, bad starts and missing categories", () => {
    const q = curve();
    expect(validateQuestion({ ...q, steps: q.steps.slice(0, 1) }, new Set()).join()).toMatch(/at least two/);
    const many = Array.from({ length: 8 }, (_, i) => ({ ...q.steps[0], id: `s${i}` }));
    expect(validateQuestion({ ...q, steps: many }, new Set()).join()).toMatch(/at most 7/);
    expect(validateQuestion({ ...q, steps: [{ ...q.steps[0], label: " " }, q.steps[1]] }, new Set()).join()).toMatch(/label/);
    expect(validateQuestion({ ...q, steps: [{ ...q.steps[0], start: 99 }, q.steps[1]] }, new Set()).join()).toMatch(/starting value/);
    expect(validateQuestion({ ...q, steps: [{ ...q.steps[0], categoryId: "gone" }, q.steps[1]] }, new Set()).join()).toMatch(/category/);
  });

  it("requires at least one moved point when required", () => {
    const q = curve();
    expect(validateAnswer(q, undefined)).toMatch(/Drag at least one point/);
    expect(validateAnswer(q, { values: {} })).toMatch(/Drag at least one point/);
    expect(validateAnswer({ ...q, required: false }, undefined)).toBeNull();
    expect(validateAnswer(q, { values: { [q.steps[0].id]: 3 } })).toBeNull();
  });

  it("rejects unknown steps and out-of-range or fractional values", () => {
    const q = curve();
    const id = q.steps[0].id;
    expect(validateAnswer(q, { values: { nope: 3 } })).toBeTruthy();
    expect(validateAnswer(q, { values: { [id]: 11 } })).toBeTruthy();
    expect(validateAnswer(q, { values: { [id]: 2.5 } })).toBeTruthy();
    expect(validateAnswer(q, { optionIds: ["x"] })).toBeTruthy();
  });
});
