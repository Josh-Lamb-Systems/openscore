import { describe, expect, it } from "vitest";
import { createDefaultDefinition, createQuestion } from "~/lib/scorecard/defaults";
import type { Definition, Tier } from "~/lib/scorecard/schema";
import { validateTiers } from "~/lib/scorecard/validate";
import { normalizeHex, parseBrandTokenOverrides, parseBrandTokens } from "./brand-tokens";
import { csvCell, toCsv } from "./csv";
import { firstName, greeting } from "./greeting";
import { buildResponsesCsvRows, type ExportResponse } from "./responses-export";
import { filtersToSearch, parseResponseFilters } from "./responses-filter";
import { addTierBySplitting, autoDistributeTiers, nextTierColor, removeTierMerging } from "./tiers";

describe("csv", () => {
  it("escapes commas, quotes and newlines", () => {
    expect(csvCell("plain")).toBe("plain");
    expect(csvCell("a,b")).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell("line\nbreak")).toBe('"line\nbreak"');
    expect(csvCell(null)).toBe("");
    expect(csvCell(undefined)).toBe("");
    expect(csvCell(42)).toBe("42");
    expect(csvCell(true)).toBe("true");
    expect(csvCell(new Date("2026-01-02T03:04:05.000Z"))).toBe("2026-01-02T03:04:05.000Z");
  });

  it("neutralises spreadsheet formulas but keeps negative numbers", () => {
    expect(csvCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(csvCell("@cmd")).toBe("'@cmd");
    expect(csvCell("+1 555")).toBe("'+1 555");
    expect(csvCell("-5")).toBe("-5");
    expect(csvCell("-5 kg")).toBe("-5 kg");
    expect(csvCell(-3)).toBe("-3");
  });

  it("joins rows with CRLF", () => {
    expect(
      toCsv([
        ["a", "b"],
        [1, "x,y"],
      ]),
    ).toBe('a,b\r\n1,"x,y"\r\n');
  });
});

describe("autoDistributeTiers", () => {
  const tier = (name: string): Tier => ({ id: name, name, min: 0, max: 0, color: "#000000" });

  it("spreads tiers evenly over 0–100 with no gaps", () => {
    for (let n = 1; n <= 12; n++) {
      const tiers = autoDistributeTiers(Array.from({ length: n }, (_, i) => tier(`t${i}`)));
      expect(tiers).toHaveLength(n);
      expect(validateTiers(tiers)).toEqual([]);
    }
  });

  it("produces familiar ranges", () => {
    const three = autoDistributeTiers([tier("a"), tier("b"), tier("c")]);
    expect(three.map((t) => [t.min, t.max])).toEqual([
      [0, 33],
      [34, 66],
      [67, 100],
    ]);
    const two = autoDistributeTiers([tier("a"), tier("b")]);
    expect(two.map((t) => [t.min, t.max])).toEqual([
      [0, 50],
      [51, 100],
    ]);
  });

  it("keeps names and order", () => {
    const out = autoDistributeTiers([tier("x"), tier("y")]);
    expect(out.map((t) => t.name)).toEqual(["x", "y"]);
  });

  it("adds a tier by splitting the widest range and stays valid", () => {
    const tiers = autoDistributeTiers([tier("a"), tier("b")]);
    const out = addTierBySplitting(tiers, (min, max) => ({ ...tier("new"), min, max }));
    expect(out.map((t) => [t.name, t.min, t.max])).toEqual([
      ["a", 0, 25],
      ["new", 26, 50],
      ["b", 51, 100],
    ]);
    expect(validateTiers(out)).toEqual([]);
    expect(addTierBySplitting([], (min, max) => ({ ...tier("x"), min, max }))[0]).toMatchObject({ min: 0, max: 100 });
  });

  it("removes a tier and merges its range into a neighbour", () => {
    const tiers = autoDistributeTiers([tier("a"), tier("b"), tier("c")]);
    expect(removeTierMerging(tiers, "b").map((t) => [t.min, t.max])).toEqual([
      [0, 66],
      [67, 100],
    ]);
    expect(removeTierMerging(tiers, "a").map((t) => [t.min, t.max])).toEqual([
      [0, 66],
      [67, 100],
    ]);
    expect(validateTiers(removeTierMerging(tiers, "c"))).toEqual([]);
  });

  it("picks an unused colour", () => {
    expect(nextTierColor([{ ...tier("a"), color: "#dc2626" }])).toBe("#D97706");
  });
});

describe("greeting", () => {
  it("varies by hour", () => {
    expect(greeting(8)).toBe("Good morning");
    expect(greeting(13)).toBe("Good afternoon");
    expect(greeting(21)).toBe("Good evening");
    expect(firstName("  Ada  Lovelace ")).toBe("Ada");
  });
});

describe("response filters", () => {
  it("parses with defaults", () => {
    expect(parseResponseFilters(new URLSearchParams(""), "test")).toEqual({
      q: "",
      data: "test",
      status: "all",
      page: 1,
    });
    expect(parseResponseFilters(new URLSearchParams("data=all&status=completed&page=3&q=%20bob%20"), "live")).toEqual({
      q: "bob",
      data: "all",
      status: "completed",
      page: 3,
    });
    expect(parseResponseFilters(new URLSearchParams("data=nope&page=-1"), "live").page).toBe(1);
  });

  it("serialises without defaults", () => {
    expect(filtersToSearch({ q: "", data: "live", status: "all", page: 1 })).toBe("?data=live");
    expect(filtersToSearch({ q: "a b", status: "incomplete", page: 2 })).toBe("?q=a+b&status=incomplete&page=2");
    expect(filtersToSearch({})).toBe("");
  });
});

describe("brand tokens", () => {
  it("normalises hex colours", () => {
    expect(normalizeHex("#abc")).toBe("#AABBCC");
    expect(normalizeHex("0d9488")).toBe("#0D9488");
    expect(normalizeHex("teal")).toBeNull();
  });

  it("parses full tokens with defaults and rejects bad values", () => {
    const ok = parseBrandTokens(JSON.stringify({ primaryColor: "#123456" }));
    expect(ok.ok && ok.tokens.primaryColor).toBe("#123456");
    const bad = parseBrandTokens(
      JSON.stringify({ primaryColor: "red", logoUrl: "javascript:alert(1)", font: "comic" }),
    );
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(Object.keys(bad.errors).sort()).toEqual(["font", "logoUrl", "primaryColor"]);
  });

  it("parses partial overrides", () => {
    const res = parseBrandTokenOverrides(JSON.stringify({ buttonRadius: 12 }));
    expect(res).toEqual({ ok: true, overrides: { buttonRadius: 12 } });
    expect(parseBrandTokenOverrides("{").ok).toBe(false);
  });
});

describe("buildResponsesCsvRows", () => {
  function definition(): Definition {
    const d = createDefaultDefinition("Test");
    const q1 = { ...createQuestion("yes_no"), id: "q1", text: "Do you plan?" };
    const q2 = { ...createQuestion("numeric"), id: "q2", text: "How many staff?", unit: "people" };
    const info = { ...createQuestion("info"), id: "info1", text: "Intermission" };
    d.questions = [q1, info, q2];
    d.categories = [{ id: "c1", name: "Planning", description: "" }];
    return d;
  }

  it("builds a header and one row per response", () => {
    const latest = definition();
    const old: Definition = {
      ...definition(),
      questions: [{ ...createQuestion("open_text"), id: "q_old", text: "Old, removed" }],
    };
    const base: Omit<ExportResponse, "id" | "definition" | "answers"> = {
      startedAt: new Date("2026-01-01T00:00:00Z"),
      completedAt: null,
      isTest: false,
      lead: { firstName: "Ada", lastName: "L", email: "ada@example.com" },
      consent: { mode: "explicit_optional", given: true, at: null },
      overallPercent: 50,
      tierId: latest.tiers[1].id,
      categoryScores: [{ categoryId: "c1", name: "Planning", percent: 75 }],
    };
    const rows = buildResponsesCsvRows(latest, [
      { ...base, id: "r1", definition: latest, answers: { q1: { optionIds: ["yes"] }, q2: { value: 12 } } },
      {
        ...base,
        id: "r2",
        definition: old,
        lead: { ...base.lead, custom_x: "extra" },
        answers: { q_old: { text: "hello" } },
      },
    ]);
    expect(rows[0]).toEqual([
      "id",
      "started_at",
      "completed_at",
      "is_test",
      "First name",
      "Last name",
      "Email",
      "custom_x",
      "consent",
      "overall_percent",
      "tier",
      "Planning %",
      "Do you plan?",
      "How many staff?",
      "Old, removed",
    ]);
    expect(rows[1].slice(4, 15)).toEqual([
      "Ada",
      "L",
      "ada@example.com",
      "",
      "yes",
      50,
      "Making progress",
      75,
      "Yes",
      "12 people",
      "",
    ]);
    expect(rows[2].at(-1)).toBe("hello");
    expect(rows[2][7]).toBe("extra");
    expect(rows[2][10]).toBe(""); // tier id not in the old definition's tiers
    const csv = toCsv(rows);
    expect(csv).toContain('"Old, removed"');
  });
});
