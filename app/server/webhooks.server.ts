import { and, arrayContains, eq } from "drizzle-orm";
import { formatAnswer } from "~/lib/scorecard/format";
import { isScoredQuestion } from "~/lib/scorecard/schema";
import { db, pool, schema } from "./db.server";
import { createId, createToken } from "./ids.server";
import { definitionForResponse, getResponse, resultUrl } from "./responses.server";
import { getScorecard } from "./scorecards.server";
import type { WebhookEvent } from "./schema.server";
import { signPayload } from "./webhook-signature.server";

/**
 * Outbound webhooks (docs/SPEC.md §10).
 *
 * Events are written to `webhook_deliveries` (one row per subscribed webhook) and
 * delivered by the worker (`npm run worker`), which retries with backoff.
 *
 * Signature: `OpenScore-Signature: t=<unix seconds>,v1=<hex HMAC-SHA256(secret, "<t>.<raw body>")>`.
 */

export const RETRY_DELAYS_SECONDS = [60, 5 * 60, 30 * 60, 2 * 60 * 60, 6 * 60 * 60];
export const MAX_ATTEMPTS = RETRY_DELAYS_SECONDS.length + 1;
const TIMEOUT_MS = 10_000;

export function createWebhookSecret(): string {
  return `whsec_${createToken(24)}`;
}

export { signPayload, verifySignature } from "./webhook-signature.server";

// ---------------------------------------------------------------------------
// Payloads
// ---------------------------------------------------------------------------

async function responseContext(responseId: string) {
  const response = await getResponse(responseId);
  if (!response) return null;
  const scorecard = await getScorecard(response.scorecardId);
  if (!scorecard) return null;
  const { definition, version } = await definitionForResponse(response);
  return { response, scorecard, definition, version };
}

type Ctx = NonNullable<Awaited<ReturnType<typeof responseContext>>>;

function basePayload(ctx: Ctx) {
  const { response, scorecard, version } = ctx;
  return {
    isTest: response.isTest,
    scorecard: { id: scorecard.id, name: scorecard.name, slug: scorecard.slug, version },
    response: {
      id: response.id,
      startedAt: response.startedAt.toISOString(),
      lead: response.lead,
      email: response.email,
      consent: response.consent,
    },
  };
}

export async function buildLeadCapturedPayload(responseId: string) {
  const ctx = await responseContext(responseId);
  if (!ctx) return null;
  const base = basePayload(ctx);
  return {
    event: "lead.captured" as const,
    ...base,
    response: { ...base.response, leadCapturedAt: ctx.response.leadCapturedAt?.toISOString() ?? null },
  };
}

export async function buildResponseCompletedPayload(responseId: string) {
  const ctx = await responseContext(responseId);
  if (!ctx) return null;
  const { response, scorecard, definition } = ctx;
  const base = basePayload(ctx);
  const tierName = (id: string | null) => definition.tiers.find((t) => t.id === id)?.name ?? null;
  const categoryName = (id: string | null) => definition.categories.find((c) => c.id === id)?.name ?? null;
  return {
    event: "response.completed" as const,
    ...base,
    response: {
      ...base.response,
      leadCapturedAt: response.leadCapturedAt?.toISOString() ?? null,
      completedAt: response.completedAt?.toISOString() ?? null,
      resultUrl: resultUrl(scorecard.slug, response.resultToken),
      score: {
        percent: response.overallPercent,
        points: response.points?.points ?? null,
        maxPoints: response.points?.maxPoints ?? null,
        tier: response.tierId ? { id: response.tierId, name: tierName(response.tierId) } : null,
      },
      categories: (response.categoryScores ?? []).map((c) => ({
        id: c.categoryId,
        name: c.name,
        percent: c.percent,
        points: c.points,
        maxPoints: c.maxPoints,
        tier: c.tierId ? { id: c.tierId, name: tierName(c.tierId) } : null,
      })),
      answers: definition.questions
        .filter((q) => q.type !== "info")
        .map((q) => ({
          questionId: q.id,
          question: q.text,
          type: q.type,
          category: categoryName(q.categoryId),
          scored: isScoredQuestion(q),
          answer: formatAnswer(q, response.answers[q.id]),
          value: response.answers[q.id] ?? null,
        })),
    },
  };
}

// ---------------------------------------------------------------------------
// Enqueueing
// ---------------------------------------------------------------------------

async function enqueue(scorecardId: string, event: WebhookEvent, payload: object) {
  const hooks = await db
    .select()
    .from(schema.webhooks)
    .where(
      and(
        eq(schema.webhooks.scorecardId, scorecardId),
        eq(schema.webhooks.enabled, true),
        arrayContains(schema.webhooks.events, [event]),
      ),
    );
  if (hooks.length === 0) return;
  await db.insert(schema.webhookDeliveries).values(
    hooks.map((h) => ({ id: createId("dlv"), webhookId: h.id, event, payload })),
  );
}

/** Call after the lead form is submitted. Never throws (webhooks must not break the respondent flow). */
export async function emitLeadCaptured(responseId: string): Promise<void> {
  try {
    const payload = await buildLeadCapturedPayload(responseId);
    const r = await getResponse(responseId);
    if (payload && r) await enqueue(r.scorecardId, "lead.captured", payload);
  } catch (err) {
    console.error("[webhooks] failed to enqueue lead.captured", err);
  }
}

/** Call after a response is completed and scored. Never throws. */
export async function emitResponseCompleted(responseId: string): Promise<void> {
  try {
    const payload = await buildResponseCompletedPayload(responseId);
    const r = await getResponse(responseId);
    if (payload && r) await enqueue(r.scorecardId, "response.completed", payload);
  } catch (err) {
    console.error("[webhooks] failed to enqueue response.completed", err);
  }
}

/** Queues a "ping" test event for one webhook and attempts delivery immediately. */
export async function sendTestWebhook(webhookId: string) {
  const [hook] = await db.select().from(schema.webhooks).where(eq(schema.webhooks.id, webhookId)).limit(1);
  if (!hook) throw new Error("Webhook not found");
  const id = createId("dlv");
  const payload = {
    event: "ping",
    isTest: true,
    message: "This is a test event from OpenScore.",
    sentAt: new Date().toISOString(),
  };
  await db.insert(schema.webhookDeliveries).values({ id, webhookId, event: "ping", payload });
  return attemptDelivery(id);
}

// ---------------------------------------------------------------------------
// Delivery (used by the worker)
// ---------------------------------------------------------------------------

export async function attemptDelivery(deliveryId: string) {
  const [row] = await db
    .select({ delivery: schema.webhookDeliveries, webhook: schema.webhooks })
    .from(schema.webhookDeliveries)
    .innerJoin(schema.webhooks, eq(schema.webhooks.id, schema.webhookDeliveries.webhookId))
    .where(eq(schema.webhookDeliveries.id, deliveryId))
    .limit(1);
  if (!row) return null;
  const { delivery, webhook } = row;

  const body = JSON.stringify(delivery.payload);
  const timestamp = Math.floor(Date.now() / 1000);
  const started = Date.now();
  let httpStatus: number | null = null;
  let error: string | null = null;
  let excerpt: string | null = null;

  try {
    const res = await fetch(webhook.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "OpenScore-Webhooks/1",
        "OpenScore-Event": delivery.event,
        "OpenScore-Delivery": delivery.id,
        "OpenScore-Signature": signPayload(webhook.secret, timestamp, body),
      },
      body,
      signal: AbortSignal.timeout(TIMEOUT_MS),
      redirect: "manual",
    });
    httpStatus = res.status;
    excerpt = (await res.text().catch(() => "")).slice(0, 1000);
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }

  const ok = httpStatus != null && httpStatus >= 200 && httpStatus < 300;
  const attempts = delivery.attempts + 1;
  const retryIn = RETRY_DELAYS_SECONDS[attempts - 1];
  // Test pings are one-shot: the admin sees the result immediately, so don't retry them.
  const status = ok
    ? "succeeded"
    : delivery.event === "ping" || attempts >= MAX_ATTEMPTS || retryIn == null
      ? "failed"
      : "pending";

  const [updated] = await db
    .update(schema.webhookDeliveries)
    .set({
      attempts,
      status,
      lastHttpStatus: httpStatus,
      lastError: ok ? null : (error ?? `HTTP ${httpStatus}`),
      lastResponseExcerpt: excerpt,
      lastDurationMs: Date.now() - started,
      deliveredAt: ok ? new Date() : null,
      nextAttemptAt: status === "pending" ? new Date(Date.now() + retryIn! * 1000) : delivery.nextAttemptAt,
    })
    .where(eq(schema.webhookDeliveries.id, delivery.id))
    .returning();
  return updated;
}

/**
 * Claims up to `limit` due deliveries (SKIP LOCKED, so several workers can run)
 * by pushing their next_attempt_at forward as a lease, then delivers them.
 */
export async function deliverDue(limit = 20): Promise<number> {
  const { rows } = await pool.query<{ id: string }>(
    `update webhook_deliveries set next_attempt_at = now() + interval '2 minutes'
     where id in (
       select id from webhook_deliveries
       where status = 'pending' and next_attempt_at <= now()
       order by next_attempt_at
       limit $1
       for update skip locked
     )
     returning id`,
    [limit],
  );
  await Promise.all(rows.map((r) => attemptDelivery(r.id)));
  return rows.length;
}

