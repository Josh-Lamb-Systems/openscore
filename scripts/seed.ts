/**
 * Dev seed: creates and publishes an example scorecard, "The Sales Growth
 * Scorecard" (slug `sales-growth`), attributed to the first admin user.
 *
 *   npm run db:seed            # skips if it already exists
 *   npm run db:seed -- --force # deletes and recreates it (and its responses)
 */
import { asc, eq } from "drizzle-orm";
import { createDefaultDefinition, defaultLeadFields, newId } from "~/lib/scorecard/defaults";
import { DEFINITION_SCHEMA_VERSION, definitionSchema, type Definition, type Question } from "~/lib/scorecard/schema";
import { db, pool, schema } from "~/server/db.server";
import { createId } from "~/server/ids.server";
import { sanitizeRichText } from "~/server/sanitize.server";
import { deleteScorecard, publishScorecard } from "~/server/scorecards.server";

const SLUG = "sales-growth";
const NAME = "The Sales Growth Scorecard";

const opt = (label: string, points: number, id = newId("opt")) => ({ id, label, points, imageUrl: null });
const common = (id: string, text: string, categoryId: string | null, required = true) => ({
  id,
  text,
  instruction: "",
  showInstruction: false,
  required,
  categoryId,
  media: null,
});

function buildDefinition(): Definition {
  const base = createDefaultDefinition(NAME);
  const cat = { process: newId("cat"), team: newId("cat"), pipeline: newId("cat") };
  const [low, mid, high] = base.tiers;

  const questions: Question[] = [
    {
      ...common(newId("q"), "Do you have a documented sales process that every rep follows?", cat.process),
      type: "yes_no",
      showMaybe: true,
      randomize: false,
      options: [opt("Yes", 3, "yes"), opt("No", 0, "no"), opt("Partly", 1, "maybe")],
    },
    {
      ...common(newId("q"), "How many qualified opportunities are in your pipeline right now?", cat.pipeline),
      type: "choice_buttons",
      randomize: false,
      options: [opt("Fewer than 10", 0), opt("10–25", 1), opt("26–50", 2), opt("More than 50", 3)],
    },
    {
      ...common(newId("q"), "How do you onboard new salespeople?", cat.team),
      type: "choice_radio",
      randomize: false,
      options: [
        opt("They learn on the job", 0),
        opt("They shadow a senior rep for a while", 1),
        opt("A structured programme with playbooks", 2),
        opt("A structured programme plus ongoing coaching", 3),
      ],
    },
    {
      ...common(newId("q"), "Which of these does your team use every week?", cat.process),
      showInstruction: true,
      instruction: "Select all that apply.",
      type: "choice_checkbox",
      randomize: true,
      options: [
        opt("A CRM that is kept up to date", 1),
        opt("Call recording and review", 1),
        opt("A written qualification framework", 1),
        opt("A weekly forecast meeting", 1),
        opt("None of these", 0),
      ],
      minSelections: 1,
      maxSelections: null,
    },
    {
      ...common(newId("q"), "Halfway there", null, false),
      type: "info",
      body: sanitizeRichText(
        "<p>Great progress. The next few questions look at your <strong>team</strong> and the health of your <strong>pipeline</strong>.</p>",
      ),
      buttonLabel: "Keep going",
    },
    {
      ...common(newId("q"), "How confident are you that your team will hit this quarter's target?", cat.team),
      type: "linear_scale",
      min: 1,
      max: 10,
      start: null,
      pointsMin: 0,
      pointsMax: 4,
      labels: { left: "Not at all", center: "", right: "Completely" },
    },
    {
      ...common(newId("q"), "What percentage of your forecast deals close in the month you expected?", cat.pipeline),
      type: "sliding_scale",
      min: 0,
      max: 100,
      step: 5,
      start: 50,
      pointsMin: 0,
      pointsMax: 4,
      labels: { left: "Hardly any", center: "", right: "All of them" },
    },
    {
      ...common(newId("q"), "How many new leads does your team generate per month?", cat.pipeline),
      type: "numeric",
      min: 0,
      max: null,
      unit: "leads",
      ranges: [
        { id: newId("rng"), min: null, max: 19, points: 0 },
        { id: newId("rng"), min: 20, max: 99, points: 2 },
        { id: newId("rng"), min: 100, max: null, points: 4 },
      ],
    },
    {
      ...common(newId("q"), "Sales and marketing agree on what makes a qualified lead.", cat.team),
      type: "divided_scale",
      options: [opt("Strongly disagree", 0), opt("Disagree", 1), opt("Agree", 2), opt("Strongly agree", 3)],
    },
    {
      ...common(newId("q"), "Find the constraint: how fast does each step of your process move?", null),
      showInstruction: true,
      instruction: "Drag each point up or down. Be honest; the slowest step limits everything after it.",
      type: "process_curve",
      steps: [
        { id: newId("step"), label: "Leads", categoryId: cat.pipeline, start: 5 },
        { id: newId("step"), label: "Sales calls", categoryId: cat.process, start: 5 },
        { id: newId("step"), label: "Onboarding", categoryId: cat.team, start: 5 },
        { id: newId("step"), label: "Delivery", categoryId: cat.team, start: 5 },
        { id: newId("step"), label: "Invoicing", categoryId: cat.process, start: 5 },
      ],
      min: 1,
      max: 10,
      pointsMin: 0,
      pointsMax: 3,
      topLabel: "+ Fast",
      bottomLabel: "– Slow",
      constraintLabel: "The constraint",
    },
    {
      ...common(newId("q"), "What is the single biggest obstacle to growing your sales right now?", null, false),
      type: "open_text",
      multiline: true,
      placeholder: "Tell us in a sentence or two (optional)",
    },
  ];

  const html = (s: string) => sanitizeRichText(s);
  const tierContent = {
    [low.id]: {
      body: html(
        "<p>Your sales engine is running on effort rather than system. That's normal for growing teams, and it means there are quick wins on the table.</p><p>Start with your biggest constraint, <strong>{{constraint}}</strong>: write down how work moves through it, then make sure everyone follows that.</p>",
      ),
      ctaLabel: "Book a strategy call",
      ctaUrl: "https://example.com/strategy-call",
      ctaText: "Get a 30-minute plan to build your sales foundations.",
    },
    [mid.id]: {
      body: html(
        "<p>You have solid foundations, but growth still depends on a few people and a few good months. The next step is consistency.</p><p>Your constraint right now is <strong>{{constraint}}</strong>. Improving anything else won't speed you up until that step does.</p>",
      ),
      ctaLabel: "Book a strategy call",
      ctaUrl: "https://example.com/strategy-call",
      ctaText: "Find out which two changes would add the most revenue next quarter.",
    },
    [high.id]: {
      body: html(
        "<p>Your sales organisation is in great shape: a clear process, a capable team and a healthy pipeline.</p><p>Your opportunity now is scale. Protect what works while you add people, markets and channels.</p>",
      ),
      ctaLabel: "Book a strategy call",
      ctaUrl: "https://example.com/strategy-call",
      ctaText: "Let's map out your next stage of growth together.",
    },
  };

  const categoryContent = {
    [cat.process]: {
      [low.id]: html("<p>Deals move differently depending on who owns them. Document your stages and exit criteria.</p>"),
      [mid.id]: html("<p>You have a process; now make it the default. Review a few deals against it each week.</p>"),
      [high.id]: html("<p>Your process is clear and followed. Keep refining it with win/loss reviews.</p>"),
    },
    [cat.team]: {
      [low.id]: html("<p>New reps are left to figure things out. A simple onboarding plan pays back quickly.</p>"),
      [mid.id]: html("<p>Your team is capable. Regular coaching will turn good reps into great ones.</p>"),
      [high.id]: html("<p>Your team is confident and aligned with marketing. Make sure you're developing future leaders.</p>"),
    },
    [cat.pipeline]: {
      [low.id]: html("<p>Your pipeline is thin or unpredictable. Focus on consistent lead generation first.</p>"),
      [mid.id]: html("<p>Pipeline volume is there; improve forecast accuracy by qualifying harder.</p>"),
      [high.id]: html("<p>A healthy, predictable pipeline. Look for the channels that could double it.</p>"),
    },
  };

  return definitionSchema.parse({
    schemaVersion: DEFINITION_SCHEMA_VERSION,
    startScreen: {
      title: NAME,
      subtitle: "Answer 9 quick questions and get a personalised report on your sales engine",
      description:
        "This scorecard shows founders and sales leaders where their sales process, team and pipeline are strong, and where revenue is leaking.",
      bullets: ["It takes just 3 minutes", "It's completely free", "Receive customised results instantly"],
      buttonLabel: "Start",
      imageUrl: null,
    },
    leadForm: {
      ...base.leadForm,
      fields: [
        ...defaultLeadFields(),
        {
          id: "companySize",
          key: "custom_companySize",
          label: "Company size",
          type: "select",
          required: false,
          enabled: true,
          builtIn: false,
          options: ["1–10", "11–50", "51–200", "201+"],
        },
      ],
      consent: {
        mode: "explicit_optional",
        label: "Send me occasional sales tips by email",
        privacyStatement: "We'll use your details to send your results. You can unsubscribe at any time.",
        privacyUrl: "https://example.com/privacy",
      },
    },
    categories: [
      { id: cat.process, name: "Sales Process", description: "How consistently deals are run" },
      { id: cat.team, name: "Team", description: "Hiring, onboarding and alignment" },
      { id: cat.pipeline, name: "Pipeline", description: "Volume and predictability of opportunities" },
    ],
    questions,
    tiers: base.tiers,
    resultPage: {
      headline: "Your results, {{firstName}}",
      showOverallScore: true,
      showCategoryBreakdown: true,
      tierContent,
      categoryContent,
      footerText: "OpenScore example scorecard · Results are for illustration only.",
    },
  });
}

async function main() {
  const [admin] = await db
    .select()
    .from(schema.user)
    .where(eq(schema.user.role, "admin"))
    .orderBy(asc(schema.user.createdAt))
    .limit(1);
  if (!admin) {
    throw new Error("No admin user exists yet. Start the app, create the first admin at /setup, then run the seed again.");
  }

  const [existing] = await db.select().from(schema.scorecards).where(eq(schema.scorecards.slug, SLUG)).limit(1);
  if (existing) {
    if (!process.argv.includes("--force")) {
      console.info(`[seed] "${NAME}" already exists (/s/${SLUG}); nothing to do. Use --force to recreate it.`);
      return;
    }
    await deleteScorecard(existing.id);
    console.info(`[seed] deleted existing "${NAME}"`);
  }

  const [orgRow] = await db.select().from(schema.orgSettings).limit(1);
  const id = createId("sc");
  await db.insert(schema.scorecards).values({
    id,
    slug: SLUG,
    name: NAME,
    draftDefinition: buildDefinition(),
    brandKitId: orgRow?.defaultBrandKitId ?? null,
    settings: {
      shareTitle: "",
      shareDescription: "How healthy is your sales engine? Take the 3-minute scorecard and get a personalised report.",
      shareImageUrl: "",
    },
    createdBy: admin.id,
  });

  const result = await publishScorecard(id, admin.id);
  if (!result.ok) {
    throw new Error(`Publishing failed:\n${result.issues.map((i) => `  ${i.path}: ${i.message}`).join("\n")}`);
  }
  console.info(`[seed] created and published "${NAME}" (v${result.version}) → /s/${SLUG}`);
}

try {
  await main();
} catch (err) {
  console.error(`[seed] ${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = 1;
} finally {
  await pool.end();
}
