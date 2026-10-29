import type { Definition } from "./schema";
import { validateLeadForm, validateQuestion, validateTiers } from "./validate";

/**
 * The scorecard setup checklist. Each step is complete when it is auto-detected
 * as done or the user ticked it manually (stored in settings.completedSteps).
 */
export const SETUP_STEPS = [
  { id: "branding", title: "Branding & Theme", path: "theme", description: "Add your logo, fonts and colours so your scorecard looks professional and trustworthy. Theme settings apply across the whole scorecard." },
  { id: "questions", title: "Questions & Scoring", path: "build/questions", description: "Ask the right questions and score them correctly so you can deliver valuable feedback. Tip: a short set of relevant, easy-to-answer questions improves your completion rate." },
  { id: "tiers", title: "Score Tiers", path: "settings/tiers", description: "Define the score ranges that group respondents (for example Beginner, Intermediate, Advanced). Each tier gets its own results content." },
  { id: "results", title: "Results Page", path: "build/results", description: "Write tier-specific feedback, per-category insights and a clear next step for every respondent." },
  { id: "leadForm", title: "Lead Form", path: "settings/lead-form", description: "Choose which details to collect, whether to ask before or after the questions, and how consent works." },
  { id: "test", title: "Preview & Test in Draft Mode", path: "preview", description: "Take your scorecard yourself. Draft-mode responses are marked as test data and don't count as leads." },
  { id: "publish", title: "Publish", path: "home", description: "Publishing freezes a version of your scorecard and makes the public link live." },
  { id: "share", title: "Share & Embed", path: "share", description: "Share the link or embed the scorecard on your website." },
] as const;

export type SetupStepId = (typeof SETUP_STEPS)[number]["id"];

export interface SetupState {
  definition: Definition;
  hasBranding: boolean;
  hasTestResponse: boolean;
  isLive: boolean;
  completedSteps: string[];
}

export function detectSetupStep(id: SetupStepId, s: SetupState): boolean {
  const d = s.definition;
  const categoryIds = new Set(d.categories.map((c) => c.id));
  switch (id) {
    case "branding":
      return s.hasBranding;
    case "questions":
      return (
        d.questions.some((q) => q.type !== "info") &&
        d.questions.every((q) => validateQuestion(q, categoryIds).length === 0)
      );
    case "tiers":
      return false; // Tiers have valid defaults, so this step is ticked manually.
    case "results":
      return Object.values(d.resultPage.tierContent).some((c) => c.body.replace(/<[^>]*>/g, "").trim() !== "");
    case "leadForm":
      return false; // Has valid defaults; ticked manually.
    case "test":
      return s.hasTestResponse;
    case "publish":
      return s.isLive;
    case "share":
      return false;
  }
}

export function setupProgress(s: SetupState) {
  const steps = SETUP_STEPS.map((step) => {
    const auto = detectSetupStep(step.id, s);
    const tierIssues = step.id === "tiers" ? validateTiers(s.definition.tiers).length > 0 : false;
    const leadIssues = step.id === "leadForm" ? validateLeadForm(s.definition.leadForm).length > 0 : false;
    const done = !tierIssues && !leadIssues && (auto || s.completedSteps.includes(step.id));
    return { ...step, done, auto };
  });
  const completed = steps.filter((st) => st.done).length;
  return { steps, completed, total: steps.length, percent: Math.round((100 * completed) / steps.length) };
}
