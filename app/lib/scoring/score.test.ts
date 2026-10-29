import { describe, expect, it } from "vitest";
import { createDefaultDefinition, createQuestion } from "~/lib/scorecard/defaults";
import type { Definition, Question, QuestionOfType, Tier } from "~/lib/scorecard/schema";
import {
  findConstraint,
  firstConstraint,
  percentOf,
  processCurveValues,
  questionMaxPoints,
  questionPoints,
  scalePoints,
  scoreResponse,
  tierForPercent,
} from "./score";

function q<T extends Question["type"]>(type: T, patch: Partial<QuestionOfType<T>> = {}) {
  return { ...(createQuestion(type) as QuestionOfType<T>), text: "Q", ...patch };
}

const opts = (...points: number[]) =>
  points.map((p, i) => ({ id: `o${i}`, label: `O${i}`, points: p, imageUrl: null }));

const tiers: Tier[] = [
  { id: "low", name: "Low", min: 0, max: 40, color: "" },
  { id: "mid", name: "Mid", min: 41, max: 70, color: "" },
  { id: "high", name: "High", min: 71, max: 100, color: "" },
];

describe("questionMaxPoints", () => {
  it("uses the best single option for single-select types", () => {
    expect(questionMaxPoints(q("choice_buttons", { options: opts(0, 3, 2) }))).toBe(3);
    expect(questionMaxPoints(q("choice_radio", { options: opts(5, 1) }))).toBe(5);
    expect(questionMaxPoints(q("divided_scale", { options: opts(0, 1, 2, 3) }))).toBe(3);
  });

  it("ignores the hidden maybe option on yes/no", () => {
    const yn = q("yes_no", {
      options: [
        { id: "yes", label: "Yes", points: 1, imageUrl: null },
        { id: "no", label: "No", points: 0, imageUrl: null },
        { id: "maybe", label: "Maybe", points: 5, imageUrl: null },
      ],
    });
    expect(questionMaxPoints(yn)).toBe(1);
    expect(questionMaxPoints({ ...yn, showMaybe: true })).toBe(5);
  });

  it("sums positive options for checkboxes, respecting maxSelections", () => {
    expect(questionMaxPoints(q("choice_checkbox", { options: opts(1, 2, 3, 0) }))).toBe(6);
    expect(questionMaxPoints(q("choice_checkbox", { options: opts(1, 2, 3), maxSelections: 2 }))).toBe(5);
  });

  it("sums options for multi-select image buttons only", () => {
    expect(questionMaxPoints(q("image_buttons", { options: opts(1, 2) }))).toBe(2);
    expect(questionMaxPoints(q("image_buttons", { options: opts(1, 2), multiSelect: true }))).toBe(3);
  });

  it("uses the points range for scales and the best range for numeric", () => {
    expect(questionMaxPoints(q("linear_scale", { pointsMin: 1, pointsMax: 10 }))).toBe(10);
    expect(questionMaxPoints(q("sliding_scale", { pointsMin: 10, pointsMax: 0 }))).toBe(10);
    expect(
      questionMaxPoints(
        q("numeric", {
          ranges: [
            { id: "a", min: null, max: 5, points: 4 },
            { id: "b", min: 6, max: null, points: 1 },
          ],
        }),
      ),
    ).toBe(4);
  });

  it("is zero for unscored types", () => {
    expect(questionMaxPoints(q("open_text"))).toBe(0);
    expect(questionMaxPoints(q("info"))).toBe(0);
  });
});

describe("questionPoints", () => {
  it("scores single-select by the chosen option", () => {
    const question = q("choice_buttons", { options: opts(0, 3, 2) });
    expect(questionPoints(question, { optionIds: ["o1"] })).toBe(3);
    expect(questionPoints(question, { optionIds: ["missing"] })).toBe(0);
    expect(questionPoints(question, undefined)).toBe(0);
  });

  it("does not let a hidden maybe answer score", () => {
    const yn = q("yes_no");
    expect(questionPoints(yn, { optionIds: ["maybe"] })).toBe(0);
    expect(questionPoints(yn, { optionIds: ["yes"] })).toBe(1);
  });

  it("sums checkbox selections, de-duplicated and capped at the max", () => {
    const question = q("choice_checkbox", { options: opts(1, 2, 3), maxSelections: 2 });
    expect(questionPoints(question, { optionIds: ["o0", "o0", "o1"] })).toBe(3);
    expect(questionPoints(question, { optionIds: ["o0", "o1", "o2"] })).toBe(5);
  });

  it("maps scale values linearly onto the points range", () => {
    const linear = q("linear_scale", { min: 1, max: 10, pointsMin: 1, pointsMax: 10 });
    expect(questionPoints(linear, { value: 7 })).toBe(7);
    const slider = q("sliding_scale", { min: 0, max: 100, pointsMin: 0, pointsMax: 10 });
    expect(questionPoints(slider, { value: 25 })).toBe(2.5);
    expect(questionPoints(slider, { value: 1000 })).toBe(10);
  });

  it("supports reversed scales", () => {
    expect(scalePoints({ min: 0, max: 10, pointsMin: 10, pointsMax: 0 }, 2)).toBe(8);
  });

  it("scores numeric answers by the first matching range", () => {
    const question = q("numeric", {
      ranges: [
        { id: "a", min: null, max: 9, points: 0 },
        { id: "b", min: 10, max: 49, points: 1 },
        { id: "c", min: 50, max: null, points: 2 },
      ],
    });
    expect(questionPoints(question, { value: 3 })).toBe(0);
    expect(questionPoints(question, { value: 10 })).toBe(1);
    expect(questionPoints(question, { value: 500 })).toBe(2);
  });

  it("ignores answers of the wrong shape", () => {
    expect(questionPoints(q("choice_buttons", { options: opts(1, 2) }), { value: 1 })).toBe(0);
    expect(questionPoints(q("linear_scale"), { optionIds: ["x"] })).toBe(0);
  });
});

describe("tiers and percent", () => {
  it("rounds percent and handles zero max", () => {
    expect(percentOf(1, 3)).toBe(33);
    expect(percentOf(2, 3)).toBe(67);
    expect(percentOf(0, 0)).toBe(0);
  });

  it("picks the tier containing the percent, inclusive", () => {
    expect(tierForPercent(tiers, 0)?.id).toBe("low");
    expect(tierForPercent(tiers, 40)?.id).toBe("low");
    expect(tierForPercent(tiers, 41)?.id).toBe("mid");
    expect(tierForPercent(tiers, 100)?.id).toBe("high");
    expect(tierForPercent([], 50)).toBeNull();
  });
});

describe("scoreResponse", () => {
  function definition(): Definition {
    const def = createDefaultDefinition("Test");
    def.tiers = tiers;
    def.categories = [
      { id: "sales", name: "Sales", description: "" },
      { id: "team", name: "Team", description: "" },
      { id: "empty", name: "Empty", description: "" },
    ];
    def.questions = [
      { ...q("yes_no"), id: "q1", categoryId: "sales" },
      { ...q("linear_scale", { min: 1, max: 10, pointsMin: 1, pointsMax: 10 }), id: "q2", categoryId: "team" },
      { ...q("choice_buttons", { options: opts(0, 4) }), id: "q3", categoryId: null },
      { ...q("open_text"), id: "q4" },
      { ...q("info"), id: "q5" },
    ];
    return def;
  }

  it("computes overall, category and per-question scores", () => {
    const result = scoreResponse(definition(), {
      q1: { optionIds: ["yes"] },
      q2: { value: 4 },
      q3: { optionIds: ["o1"] },
      q4: { text: "hello" },
    });
    expect(result.overall).toEqual({ points: 9, maxPoints: 15, percent: 60 });
    expect(result.tierId).toBe("mid");
    expect(result.categories).toEqual([
      { categoryId: "sales", name: "Sales", points: 1, maxPoints: 1, percent: 100, tierId: "high" },
      { categoryId: "team", name: "Team", points: 4, maxPoints: 10, percent: 40, tierId: "low" },
    ]);
    expect(Object.keys(result.questions)).toEqual(["q1", "q2", "q3"]);
  });

  it("counts unanswered questions toward the maximum", () => {
    const result = scoreResponse(definition(), { q3: { optionIds: ["o1"] } });
    expect(result.overall).toEqual({ points: 4, maxPoints: 15, percent: 27 });
    expect(result.tierId).toBe("low");
  });

  it("returns 0% and the lowest tier when nothing is scorable", () => {
    const def = definition();
    def.questions = [{ ...q("open_text"), id: "only" }];
    const result = scoreResponse(def, {});
    expect(result.overall.percent).toBe(0);
    expect(result.tierId).toBe("low");
    expect(result.categories).toEqual([]);
  });
});

describe("process curve", () => {
  function curve(patch: Partial<QuestionOfType<"process_curve">> = {}) {
    return q("process_curve", {
      id: "pc",
      min: 1,
      max: 10,
      pointsMin: 0,
      pointsMax: 10,
      steps: [
        { id: "leads", label: "Leads", categoryId: "sales", start: 5 },
        { id: "calls", label: "Sales calls", categoryId: "sales", start: 5 },
        { id: "onboard", label: "Onboarding", categoryId: "ops", start: 5 },
        { id: "invoice", label: "Invoicing", categoryId: null, start: 5 },
      ],
      ...patch,
    });
  }

  it("has a max of steps × the top of the points range", () => {
    expect(questionMaxPoints(curve())).toBe(40);
  });

  it("fills unmoved steps with their starting values", () => {
    expect(processCurveValues(curve(), { values: { leads: 9 } })).toEqual({ leads: 9, calls: 5, onboard: 5, invoice: 5 });
    expect(processCurveValues(curve(), undefined)).toBeNull();
  });

  it("finds the lowest step, with ties going to the first", () => {
    expect(findConstraint(curve(), { values: { leads: 8, calls: 7, onboard: 2, invoice: 9 } })?.id).toBe("onboard");
    expect(findConstraint(curve(), { values: { leads: 3, calls: 3, onboard: 3, invoice: 3 } })?.id).toBe("leads");
    expect(findConstraint(curve(), { values: { leads: 8, calls: 2, onboard: 2, invoice: 9 } })?.id).toBe("calls");
    expect(findConstraint(curve(), undefined)).toBeNull();
  });

  it("splits points into each step's category and always into the overall score", () => {
    const def = createDefaultDefinition("Curve");
    def.tiers = tiers;
    def.categories = [
      { id: "sales", name: "Sales", description: "" },
      { id: "ops", name: "Ops", description: "" },
    ];
    // Question-level category is ignored for process curves.
    def.questions = [{ ...curve(), categoryId: "ops" }];
    // 1–10 mapped onto 0–10: v → (v - 1) × 10/9
    const result = scoreResponse(def, { pc: { values: { leads: 10, calls: 1, onboard: 4, invoice: 10 } } });
    expect(result.overall).toEqual({ points: 23.33, maxPoints: 40, percent: 58 });
    expect(result.categories).toEqual([
      { categoryId: "sales", name: "Sales", points: 10, maxPoints: 20, percent: 50, tierId: "mid" },
      { categoryId: "ops", name: "Ops", points: 3.33, maxPoints: 10, percent: 33, tierId: "low" },
    ]);
    expect(result.questions.pc).toEqual({ points: 23.33, maxPoints: 40 });
  });

  it("scores an unanswered curve as 0 but keeps its maximum", () => {
    const def = createDefaultDefinition("Curve");
    def.questions = [curve()];
    expect(scoreResponse(def, {}).overall).toEqual({ points: 0, maxPoints: 40, percent: 0 });
  });

  it("exposes the first answered curve's constraint for the {{constraint}} token", () => {
    const def = createDefaultDefinition("Curve");
    def.questions = [{ ...curve(), id: "a" }, { ...curve(), id: "b" }];
    expect(firstConstraint(def, {})).toBeNull();
    expect(firstConstraint(def, { b: { values: { invoice: 1 } } })?.label).toBe("Invoicing");
    expect(firstConstraint(def, { a: { values: { calls: 1 } }, b: { values: { invoice: 1 } } })?.label).toBe("Sales calls");
  });
});
