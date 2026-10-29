import { describe, expect, it } from "vitest";
import { createDefaultDefinition, createQuestion } from "./defaults";
import type { Tier } from "./schema";
import { validateAnswer, validateForPublish, validateTiers } from "./validate";

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
