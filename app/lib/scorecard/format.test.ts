import { describe, expect, it } from "vitest";
import { createQuestion } from "./defaults";
import { formatAnswer } from "./format";

describe("formatAnswer", () => {
  it("formats a process curve with its constraint", () => {
    const q = { ...createQuestion("process_curve"), text: "?" };
    if (q.type !== "process_curve") throw new Error("unreachable");
    const [a, b, c] = q.steps;
    expect(formatAnswer(q, { values: { [a.id]: 8, [c.id]: 2 } })).toBe(
      `Leads 8, Sales calls ${b.start}, Onboarding 2, Delivery 5, Invoicing 5 (constraint: Onboarding)`,
    );
    expect(formatAnswer(q, undefined)).toBe("");
  });
});
