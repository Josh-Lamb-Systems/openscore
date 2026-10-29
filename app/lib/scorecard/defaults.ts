import {
  DEFINITION_SCHEMA_VERSION,
  type ChoiceOption,
  type Definition,
  type LeadField,
  type Question,
  type QuestionType,
  type Tier,
} from "./schema";

/** Short random id for definition entities (questions, options, tiers, …). */
export function newId(prefix = ""): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  const s = Array.from(bytes, (b) => (b % 36).toString(36)).join("");
  return prefix ? `${prefix}_${s}` : s;
}

function option(label: string, points: number, id = newId("opt")): ChoiceOption {
  return { id, label, points, imageUrl: null };
}

const base = (type: QuestionType) => ({
  id: newId("q"),
  text: "",
  instruction: "",
  showInstruction: false,
  required: type !== "info" && type !== "open_text",
  categoryId: null,
  media: null,
});

export function createQuestion(type: QuestionType): Question {
  switch (type) {
    case "yes_no":
      return {
        ...base(type),
        type,
        showMaybe: false,
        randomize: false,
        options: [option("Yes", 1, "yes"), option("No", 0, "no"), option("Maybe", 0, "maybe")],
      };
    case "choice_buttons":
    case "choice_radio":
      return {
        ...base(type),
        type,
        randomize: false,
        options: [option("Answer 1", 0), option("Answer 2", 1), option("Answer 3", 2)],
      };
    case "choice_checkbox":
      return {
        ...base(type),
        type,
        randomize: false,
        options: [option("Answer 1", 1), option("Answer 2", 1), option("Answer 3", 1)],
        minSelections: null,
        maxSelections: null,
      };
    case "image_buttons":
      return {
        ...base(type),
        type,
        randomize: false,
        multiSelect: false,
        options: [option("Option 1", 0), option("Option 2", 1)],
      };
    case "sliding_scale":
      return {
        ...base(type),
        type,
        min: 0,
        max: 100,
        step: 1,
        start: 50,
        pointsMin: 0,
        pointsMax: 10,
        labels: { left: "", center: "", right: "" },
      };
    case "linear_scale":
      return {
        ...base(type),
        type,
        min: 1,
        max: 10,
        start: 1,
        pointsMin: 1,
        pointsMax: 10,
        labels: { left: "", center: "", right: "" },
      };
    case "divided_scale":
      return {
        ...base(type),
        type,
        options: [
          option("Strongly disagree", 0),
          option("Disagree", 1),
          option("Agree", 2),
          option("Strongly agree", 3),
        ],
      };
    case "numeric":
      return {
        ...base(type),
        type,
        min: 0,
        max: null,
        unit: "",
        ranges: [
          { id: newId("rng"), min: null, max: 9, points: 0 },
          { id: newId("rng"), min: 10, max: 49, points: 1 },
          { id: newId("rng"), min: 50, max: null, points: 2 },
        ],
      };
    case "open_text":
      return { ...base(type), type, multiline: false, placeholder: "" };
    case "info":
      return { ...base(type), type, body: "", buttonLabel: "Continue" };
    case "process_curve":
      return {
        ...base(type),
        type,
        steps: ["Leads", "Sales calls", "Onboarding", "Delivery", "Invoicing"].map((label) => ({
          id: newId("step"),
          label,
          categoryId: null,
          start: 5,
        })),
        min: 1,
        max: 10,
        pointsMin: 0,
        pointsMax: 10,
        topLabel: "+ Fast",
        bottomLabel: "– Slow",
        constraintLabel: "The constraint",
      };
  }
}

export function defaultLeadFields(): LeadField[] {
  return [
    { id: "firstName", key: "firstName", label: "First name", type: "text", required: true, enabled: true, builtIn: true, options: [] },
    { id: "lastName", key: "lastName", label: "Last name", type: "text", required: true, enabled: true, builtIn: true, options: [] },
    { id: "email", key: "email", label: "Email", type: "email", required: true, enabled: true, builtIn: true, options: [] },
  ];
}

export function defaultTiers(): Tier[] {
  return [
    { id: newId("tier"), name: "Getting started", min: 0, max: 40, color: "#DC2626" },
    { id: newId("tier"), name: "Making progress", min: 41, max: 70, color: "#D97706" },
    { id: newId("tier"), name: "Leading the way", min: 71, max: 100, color: "#059669" },
  ];
}

export function createDefaultDefinition(name: string): Definition {
  const tiers = defaultTiers();
  return {
    schemaVersion: DEFINITION_SCHEMA_VERSION,
    startScreen: {
      title: name,
      subtitle: "Answer a few quick questions and get a personalised report",
      description: "",
      bullets: ["It takes just 2 minutes", "It's completely free", "Receive customised results instantly"],
      buttonLabel: "Start",
      imageUrl: null,
    },
    leadForm: {
      enabled: true,
      position: "before",
      title: "Enter your details below to start the scorecard",
      submitLabel: "Start",
      fields: defaultLeadFields(),
      consent: {
        mode: "implied",
        label: "I agree to receive communications",
        privacyStatement: "",
        privacyUrl: "",
      },
    },
    categories: [],
    questions: [],
    tiers,
    resultPage: {
      headline: "Your results, {{firstName}}",
      showOverallScore: true,
      showCategoryBreakdown: true,
      tierContent: Object.fromEntries(
        tiers.map((t) => [t.id, { body: "", ctaLabel: "", ctaUrl: "", ctaText: "" }]),
      ),
      categoryContent: {},
      footerText: "",
      showProcessCurves: true,
    },
  };
}
