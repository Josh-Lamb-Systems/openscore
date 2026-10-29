import { describe, expect, it } from "vitest";
import { interpolate, interpolateHtml } from "./tokens";

describe("result page tokens", () => {
  const vars = { firstName: "Ada", constraint: "Onboarding", tier: "" };

  it("replaces tokens in plain text and tidies empty ones", () => {
    expect(interpolate("Your results, {{firstName}}", vars)).toBe("Your results, Ada");
    expect(interpolate("Your results, {{lastName}}", vars)).toBe("Your results");
    expect(interpolate("Fix {{ constraint }} first.", vars)).toBe("Fix Onboarding first.");
  });

  it("escapes values inserted into rich text HTML", () => {
    expect(interpolateHtml("<p>Hi {{firstName}}, fix {{constraint}}</p>", vars)).toBe("<p>Hi Ada, fix Onboarding</p>");
    expect(interpolateHtml("<p>{{firstName}}</p>", { firstName: `<img src=x onerror="alert(1)">` })).toBe(
      "<p>&lt;img src=x onerror=&quot;alert(1)&quot;&gt;</p>",
    );
    expect(interpolateHtml("<p>{{unknown}}</p>", vars)).toBe("<p></p>");
  });
});
