import { and, desc, eq, inArray } from "drizzle-orm";
import { db, schema } from "./db.server";
import { createId } from "./ids.server";
import type { WebhookEvent } from "./schema.server";
import { createWebhookSecret } from "./webhooks.server";

export { isWebhookEvent, WEBHOOK_EVENTS } from "~/lib/admin/webhooks";

/** Webhooks for a scorecard with their most recent delivery. */
export async function listWebhooks(scorecardId: string) {
  const hooks = await db
    .select()
    .from(schema.webhooks)
    .where(eq(schema.webhooks.scorecardId, scorecardId))
    .orderBy(schema.webhooks.createdAt);
  if (hooks.length === 0) return [];
  const d = schema.webhookDeliveries;
  const latest = await db
    .selectDistinctOn([d.webhookId], {
      webhookId: d.webhookId,
      event: d.event,
      status: d.status,
      attempts: d.attempts,
      lastHttpStatus: d.lastHttpStatus,
      lastError: d.lastError,
      updatedAt: d.updatedAt,
    })
    .from(d)
    .where(
      inArray(
        d.webhookId,
        hooks.map((h) => h.id),
      ),
    )
    .orderBy(d.webhookId, desc(d.createdAt));
  const byHook = new Map(latest.map((l) => [l.webhookId, l]));
  return hooks.map((h) => ({ ...h, lastDelivery: byHook.get(h.id) ?? null }));
}

export async function getWebhook(scorecardId: string, id: string) {
  const [hook] = await db
    .select()
    .from(schema.webhooks)
    .where(and(eq(schema.webhooks.id, id), eq(schema.webhooks.scorecardId, scorecardId)))
    .limit(1);
  return hook ?? null;
}

export async function createWebhook(scorecardId: string, url: string, events: WebhookEvent[]) {
  const [row] = await db
    .insert(schema.webhooks)
    .values({ id: createId("wh"), scorecardId, url, events, secret: createWebhookSecret(), enabled: true })
    .returning();
  return row;
}

export async function updateWebhook(
  scorecardId: string,
  id: string,
  patch: Partial<{ url: string; events: WebhookEvent[]; enabled: boolean; secret: string }>,
) {
  await db
    .update(schema.webhooks)
    .set(patch)
    .where(and(eq(schema.webhooks.id, id), eq(schema.webhooks.scorecardId, scorecardId)));
}

export async function deleteWebhook(scorecardId: string, id: string) {
  await db.delete(schema.webhooks).where(and(eq(schema.webhooks.id, id), eq(schema.webhooks.scorecardId, scorecardId)));
}
