import { timingSafeEqual } from "node:crypto";
import { and, eq, isNull, sql } from "drizzle-orm";
import {
  respondRequestSchema,
  resultPath,
  type RespondError,
  type RespondRequest,
  type RespondResult,
} from "~/lib/respond-api";
import { answerIssues, pickKnownAnswers } from "~/lib/scorecard/flow";
import { validateLead } from "~/lib/scorecard/lead";
import { definitionSchema, type Answers, type Definition } from "~/lib/scorecard/schema";
import { validateAnswer } from "~/lib/scorecard/validate";
import { scoreResponse } from "~/lib/scoring/score";
import { getSessionUser } from "./auth.server";
import { db, schema } from "./db.server";
import { createId, createToken } from "./ids.server";
import { definitionForResponse, getResponse, type ResponseRow } from "./responses.server";
import { getScorecard, getScorecardTheme, getVersion, type ScorecardRow } from "./scorecards.server";
import { emitLeadCaptured, emitResponseCompleted } from "./webhooks.server";

/**
 * Respondent business logic behind `POST /api/respond` (docs/SPEC.md §7):
 * start → lead → answer… → complete. Every call after `start` is authorised by
 * the response id plus its unguessable result token, which the browser keeps
 * in localStorage so a refresh resumes.
 */

const MAX_BODY_BYTES = 200_000;

export async function getScorecardBySlug(slug: string): Promise<ScorecardRow | null> {
  const [row] = await db.select().from(schema.scorecards).where(eq(schema.scorecards.slug, slug)).limit(1);
  return row ?? null;
}

/** Scorecard + theme + live version for the public pages. `live` is null when unpublished. */
export async function loadPublicScorecard(slug: string) {
  const scorecard = await getScorecardBySlug(slug);
  if (!scorecard) return null;
  const theme = await getScorecardTheme(scorecard);
  const version = scorecard.liveVersionId ? await getVersion(scorecard.liveVersionId) : null;
  return {
    scorecard,
    theme,
    live: version ? { versionId: version.id, definition: version.definition } : null,
  };
}

export async function getResponseByToken(token: string): Promise<ResponseRow | null> {
  const [row] = await db.select().from(schema.responses).where(eq(schema.responses.resultToken, token)).limit(1);
  return row ?? null;
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

class RespondFailure extends Error {
  constructor(
    readonly status: number,
    readonly body: RespondError,
  ) {
    super(body.error);
  }
}

const fail = (status: number, error: string, extra: Omit<RespondError, "ok" | "error"> = {}) =>
  new RespondFailure(status, { ok: false, error, ...extra });

function json(body: RespondResult, status = 200): Response {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

/** Entry point for the resource route. Always returns JSON. */
export async function handleRespond(request: Request): Promise<Response> {
  try {
    if (request.method !== "POST") throw fail(405, "Method not allowed");
    // Requiring a JSON content type forces a CORS preflight for cross-site requests,
    // which we never answer, so other sites can't drive this endpoint with a user's cookies.
    if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
      throw fail(415, "Expected application/json");
    }
    const text = await request.text();
    if (text.length > MAX_BODY_BYTES) throw fail(413, "Request too large");
    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      throw fail(400, "Invalid JSON");
    }
    const parsed = respondRequestSchema.safeParse(raw);
    if (!parsed.success) throw fail(400, "Invalid request");
    return json(await dispatch(request, parsed.data));
  } catch (err) {
    if (err instanceof RespondFailure) return json(err.body, err.status);
    console.error("[respond] unexpected error", err);
    return json({ ok: false, error: "Something went wrong" }, 500);
  }
}

async function dispatch(request: Request, body: RespondRequest): Promise<RespondResult> {
  switch (body.intent) {
    case "start":
      return start(request, body);
    case "resume": {
      const { response, scorecard } = await authorize(body.responseId, body.resultToken);
      return {
        ok: true,
        answers: response.answers,
        lead: response.lead,
        leadCaptured: response.leadCapturedAt != null,
        completed: response.completedAt != null,
        resultPath: resultPath(scorecard.slug, response.resultToken),
      };
    }
    case "lead":
      return submitLead(body);
    case "answer":
      return saveAnswer(body);
    case "complete":
      return complete(body);
  }
}

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

async function authorize(responseId: string, resultToken: string) {
  const response = await getResponse(responseId);
  if (!response || !safeEqual(response.resultToken, resultToken)) throw fail(404, "Response not found");
  const scorecard = await getScorecard(response.scorecardId);
  if (!scorecard) throw fail(404, "Response not found");
  return { response, scorecard };
}

async function authorizeOpen(responseId: string, resultToken: string) {
  const ctx = await authorize(responseId, resultToken);
  if (ctx.response.completedAt) {
    throw fail(409, "This response is already complete", {
      resultPath: resultPath(ctx.scorecard.slug, ctx.response.resultToken),
    });
  }
  const { definition } = await definitionForResponse(ctx.response);
  return { ...ctx, definition };
}

async function start(request: Request, body: Extract<RespondRequest, { intent: "start" }>): Promise<RespondResult> {
  let scorecard: ScorecardRow | null;
  let versionId: string | null = null;
  let testDefinition: Definition | null = null;

  if (body.preview) {
    if (!(await getSessionUser(request))) throw fail(401, "Sign in to preview this scorecard");
    scorecard = body.scorecardId ? await getScorecard(body.scorecardId) : null;
    if (!scorecard) throw fail(404, "Scorecard not found");
    const parsed = definitionSchema.safeParse(scorecard.draftDefinition);
    if (!parsed.success) throw fail(422, "The draft is not valid yet");
    testDefinition = parsed.data;
  } else {
    scorecard = body.slug ? await getScorecardBySlug(body.slug) : null;
    if (!scorecard?.liveVersionId) throw fail(404, "This scorecard isn't available right now.");
    versionId = scorecard.liveVersionId;
    // Pin the version the page was rendered with (it may have been republished since).
    if (body.versionId && body.versionId !== versionId) {
      const v = await getVersion(body.versionId);
      if (v && v.scorecardId === scorecard.id) versionId = v.id;
    }
  }

  const referrer = (body.referrer || request.headers.get("referer") || "").slice(0, 2000) || null;
  const [row] = await db
    .insert(schema.responses)
    .values({
      id: createId("rsp"),
      scorecardId: scorecard.id,
      versionId,
      testDefinition,
      isTest: !!body.preview,
      resultToken: createToken(),
      userAgent: request.headers.get("user-agent")?.slice(0, 500) ?? null,
      referrer,
    })
    .returning({ id: schema.responses.id, resultToken: schema.responses.resultToken });
  return { ok: true, responseId: row.id, resultToken: row.resultToken };
}

async function submitLead(body: Extract<RespondRequest, { intent: "lead" }>): Promise<RespondResult> {
  const { response, definition } = await authorizeOpen(body.responseId, body.resultToken);
  if (!definition.leadForm.enabled) throw fail(400, "This scorecard has no lead form");

  const result = validateLead(definition.leadForm, { values: body.values, consent: body.consent });
  if (!result.ok) throw fail(422, "Please check the highlighted fields", { errors: result.errors });

  const now = new Date();
  const firstCapture = response.leadCapturedAt == null;
  await db
    .update(schema.responses)
    .set({
      lead: result.lead,
      email: result.email,
      consent: { mode: definition.leadForm.consent.mode, given: result.consentGiven, at: result.consentGiven ? now.toISOString() : null },
      leadCapturedAt: response.leadCapturedAt ?? now,
    })
    .where(and(eq(schema.responses.id, response.id), isNull(schema.responses.completedAt)));

  if (firstCapture) await emitLeadCaptured(response.id);
  return { ok: true };
}

async function saveAnswer(body: Extract<RespondRequest, { intent: "answer" }>): Promise<RespondResult> {
  const { response, definition } = await authorizeOpen(body.responseId, body.resultToken);
  const q = definition.questions.find((x) => x.id === body.questionId);
  if (!q || q.type === "info") throw fail(400, "Unknown question");

  const error = validateAnswer(q, body.answer ?? undefined);
  if (error) throw fail(422, error, { errors: { [q.id]: error } });

  // Merge in SQL so concurrent saves of different questions don't clobber each other.
  const answers =
    body.answer == null
      ? sql`${schema.responses.answers} - ${q.id}::text`
      : sql`${schema.responses.answers} || ${JSON.stringify({ [q.id]: body.answer })}::jsonb`;
  await db
    .update(schema.responses)
    .set({ answers })
    .where(and(eq(schema.responses.id, response.id), isNull(schema.responses.completedAt)));
  return { ok: true };
}

async function complete(body: Extract<RespondRequest, { intent: "complete" }>): Promise<RespondResult> {
  const ctx = await authorize(body.responseId, body.resultToken);
  const path = resultPath(ctx.scorecard.slug, ctx.response.resultToken);
  if (ctx.response.completedAt) return { ok: true, resultPath: path };

  const { definition } = await definitionForResponse(ctx.response);
  let answers: Answers = { ...ctx.response.answers };
  if (body.answers) {
    const provided = pickKnownAnswers(definition, body.answers);
    const errors: Record<string, string> = {};
    for (const q of definition.questions) {
      if (!(q.id in provided)) continue;
      const error = validateAnswer(q, provided[q.id]);
      if (error) errors[q.id] = error;
    }
    if (Object.keys(errors).length > 0) throw fail(422, "Some answers are invalid", { errors });
    answers = { ...answers, ...provided };
  }
  answers = pickKnownAnswers(definition, answers);

  const issues = answerIssues(definition, answers);
  if (issues.length > 0) {
    throw fail(422, "Please answer every required question", {
      errors: Object.fromEntries(issues.map((i) => [i.questionId, i.message])),
    });
  }
  if (definition.leadForm.enabled && !ctx.response.leadCapturedAt) {
    throw fail(422, "Please fill in your details first", { errors: { lead: "required" } });
  }

  const score = scoreResponse(definition, answers);
  const updated = await db
    .update(schema.responses)
    .set({
      answers,
      overallPercent: score.overall.percent,
      points: { points: score.overall.points, maxPoints: score.overall.maxPoints },
      tierId: score.tierId,
      categoryScores: score.categories,
      completedAt: new Date(),
    })
    .where(and(eq(schema.responses.id, ctx.response.id), isNull(schema.responses.completedAt)))
    .returning({ id: schema.responses.id });

  // Only the request that actually completed the response emits the event.
  if (updated.length > 0) await emitResponseCompleted(ctx.response.id);
  return { ok: true, resultPath: path };
}
