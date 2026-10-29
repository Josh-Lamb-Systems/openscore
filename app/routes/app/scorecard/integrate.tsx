import { Eye, EyeOff, MoreHorizontal, Plus, RefreshCw, Send, Webhook } from "lucide-react";
import { useEffect, useState } from "react";
import { data, useFetcher } from "react-router";
import { CopyButton } from "~/components/admin/copy-button";
import { ResultError } from "~/components/admin/feedback";
import { Checkbox } from "~/components/admin/form-bits";
import { PageContainer } from "~/components/app/nav";
import { Button } from "~/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogFooter } from "~/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Field, Input, SectionLabel } from "~/components/ui/input";
import { Alert, Card, StatusPill } from "~/components/ui/misc";
import { Switch } from "~/components/ui/switch";
import type { ActionResult } from "~/lib/admin/action-result";
import { isHttpUrl } from "~/lib/admin/brand-tokens";
import { scorecardTitle } from "~/lib/admin/meta";
import { cn, timeAgo } from "~/lib/utils";
import { str } from "~/server/admin-actions.server";
import { isWebhookEvent, WEBHOOK_EVENTS } from "~/lib/admin/webhooks";
import { createWebhook, deleteWebhook, getWebhook, listWebhooks, updateWebhook } from "~/server/admin-webhooks.server";
import { requireScorecard } from "~/server/scorecards.server";
import type { WebhookEvent } from "~/server/schema.server";
import { createWebhookSecret, sendTestWebhook } from "~/server/webhooks.server";
import type { Route } from "./+types/integrate";

export function meta({ matches }: Route.MetaArgs) {
  return scorecardTitle("Integrate", matches);
}

export async function loader({ params }: Route.LoaderArgs) {
  const sc = await requireScorecard(params.id);
  return { webhooks: await listWebhooks(sc.id) };
}

interface TestOutcome {
  webhookId: string;
  ok: boolean;
  httpStatus: number | null;
  error: string | null;
  durationMs: number | null;
}

type IntegrateResult = ActionResult & { test?: TestOutcome };

function failure(intent: string, error: string, fieldErrors?: Record<string, string>) {
  return data<IntegrateResult>({ ok: false, intent, error, fieldErrors }, { status: 400 });
}

function success(intent: string, message: string, extra: Partial<IntegrateResult> = {}): IntegrateResult {
  return { ok: true, intent, message, ...extra };
}

function parseHookForm(form: FormData) {
  const url = str(form, "url").trim();
  const events = form.getAll("events").map(String).filter(isWebhookEvent) as WebhookEvent[];
  const fieldErrors: Record<string, string> = {};
  if (!isHttpUrl(url)) fieldErrors.url = "Enter a full URL starting with https:// (or http://).";
  if (events.length === 0) fieldErrors.events = "Choose at least one event.";
  return { url, events, fieldErrors };
}

export async function action({ request, params }: Route.ActionArgs) {
  const sc = await requireScorecard(params.id);
  const form = await request.formData();
  const intent = str(form, "intent");

  if (intent === "create") {
    const { url, events, fieldErrors } = parseHookForm(form);
    if (Object.keys(fieldErrors).length) return failure(intent, "Check the highlighted fields.", fieldErrors);
    await createWebhook(sc.id, url, events);
    return success(intent, "Webhook added");
  }

  const hook = await getWebhook(sc.id, str(form, "id"));
  if (!hook) return failure(intent, "That webhook no longer exists.");

  switch (intent) {
    case "update": {
      const { url, events, fieldErrors } = parseHookForm(form);
      if (Object.keys(fieldErrors).length) return failure(intent, "Check the highlighted fields.", fieldErrors);
      await updateWebhook(sc.id, hook.id, { url, events });
      return success(intent, "Webhook updated");
    }
    case "toggle": {
      const enabled = str(form, "enabled") === "true";
      await updateWebhook(sc.id, hook.id, { enabled });
      return success(intent, enabled ? "Webhook enabled" : "Webhook paused");
    }
    case "rotate":
      await updateWebhook(sc.id, hook.id, { secret: createWebhookSecret() });
      return success(intent, "Secret rotated. Update your receiver with the new secret.");
    case "test": {
      const res = await sendTestWebhook(hook.id);
      const outcome: TestOutcome = {
        webhookId: hook.id,
        ok: res?.status === "succeeded",
        httpStatus: res?.lastHttpStatus ?? null,
        error: res?.lastError ?? null,
        durationMs: res?.lastDurationMs ?? null,
      };
      return success(intent, outcome.ok ? "Test event delivered" : "Test event failed", { test: outcome });
    }
    case "delete":
      await deleteWebhook(sc.id, hook.id);
      return success(intent, "Webhook deleted");
  }
  return failure(intent, "Unknown action.");
}

type Hook = Route.ComponentProps["loaderData"]["webhooks"][number];

function HookDialog({
  hook,
  open,
  onOpenChange,
}: {
  hook: Hook | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const fetcher = useFetcher<IntegrateResult>();
  const intent = hook ? "update" : "create";
  const busy = fetcher.state !== "idle";
  const result = fetcher.data?.intent === intent ? fetcher.data : undefined;

  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data?.ok && fetcher.data.intent === intent) onOpenChange(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetcher.state, fetcher.data]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={hook ? "Edit webhook" : "Add webhook"} className="max-w-xl">
        <fetcher.Form method="post" key={hook?.id ?? "new"}>
          <input type="hidden" name="intent" value={intent} />
          {hook && <input type="hidden" name="id" value={hook.id} />}
          <DialogBody className="space-y-5">
            <Field
              label="Endpoint URL"
              htmlFor="wh-url"
              hint="We'll POST JSON to this URL. It must respond with a 2xx status within 10 seconds."
              error={result?.fieldErrors?.url}
            >
              <Input
                id="wh-url"
                name="url"
                type="url"
                required
                placeholder="https://example.com/webhooks/openscore"
                defaultValue={hook?.url ?? ""}
                aria-invalid={!!result?.fieldErrors?.url}
                autoFocus
              />
            </Field>
            <fieldset className="space-y-2">
              <legend className="mb-2 text-sm font-medium text-gray-800">Events</legend>
              {WEBHOOK_EVENTS.map((e) => (
                <label
                  key={e.value}
                  className="flex cursor-pointer items-start gap-3 rounded-md border border-gray-200 p-3 hover:bg-gray-50"
                >
                  <Checkbox
                    name="events"
                    value={e.value}
                    defaultChecked={hook ? hook.events.includes(e.value) : true}
                    className="mt-0.5"
                  />
                  <span>
                    <span className="block font-mono text-sm text-ink">{e.value}</span>
                    <span className="block text-sm text-gray-600">{e.description}</span>
                  </span>
                </label>
              ))}
              {result?.fieldErrors?.events && <p className="text-xs text-red-600">{result.fieldErrors.events}</p>}
            </fieldset>
          </DialogBody>
          <DialogFooter>
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Saving…" : hook ? "Save webhook" : "Add webhook"}
            </Button>
          </DialogFooter>
        </fetcher.Form>
      </DialogContent>
    </Dialog>
  );
}

function DeliveryStatus({ d }: { d: Hook["lastDelivery"] }) {
  if (!d) return <span className="text-sm text-gray-500">No deliveries yet</span>;
  const code = d.lastHttpStatus ? `HTTP ${d.lastHttpStatus}` : (d.lastError ?? "");
  const event = d.event === "ping" ? "test event" : d.event;
  return (
    <span className="inline-flex flex-wrap items-center gap-2 text-sm text-gray-600">
      {d.status === "succeeded" ? (
        <StatusPill tone="live">Delivered</StatusPill>
      ) : d.status === "failed" ? (
        <StatusPill tone="danger">Failed</StatusPill>
      ) : d.attempts > 0 ? (
        <StatusPill tone="draft">Retrying</StatusPill>
      ) : (
        <StatusPill tone="neutral">Queued</StatusPill>
      )}
      <span>
        Last {event} <span suppressHydrationWarning>{timeAgo(d.updatedAt)}</span>
        {code && <span className="text-gray-500"> · {code}</span>}
      </span>
    </span>
  );
}

function SecretRow({ hook }: { hook: Hook }) {
  const [revealed, setRevealed] = useState(false);
  const fetcher = useFetcher<IntegrateResult>();
  const rotating = fetcher.state !== "idle";
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-28 shrink-0 text-xs font-semibold uppercase tracking-wide text-gray-500">Signing secret</span>
      <code className="min-w-0 flex-1 truncate rounded bg-gray-50 px-2 py-1 font-mono text-[13px] text-gray-800">
        {revealed ? hook.secret : `${hook.secret.slice(0, 6)}${"•".repeat(24)}`}
      </code>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => setRevealed((r) => !r)}
        aria-label={revealed ? "Hide secret" : "Reveal secret"}
      >
        {revealed ? <EyeOff /> : <Eye />}
      </Button>
      <CopyButton value={hook.secret} label="Copy secret" iconOnly variant="ghost" />
      <Button
        variant="ghost"
        size="sm"
        disabled={rotating}
        onClick={() => {
          if (
            confirm(
              "Rotate the signing secret? Deliveries will be signed with the new secret immediately, so update your receiver.",
            )
          ) {
            fetcher.submit({ intent: "rotate", id: hook.id }, { method: "post" });
          }
        }}
      >
        <RefreshCw className={cn(rotating && "animate-spin")} /> Rotate
      </Button>
    </div>
  );
}

function HookCard({ hook, onEdit }: { hook: Hook; onEdit: () => void }) {
  const toggler = useFetcher<IntegrateResult>();
  const tester = useFetcher<IntegrateResult>();
  const deleter = useFetcher<IntegrateResult>();
  const enabled = toggler.formData ? toggler.formData.get("enabled") === "true" : hook.enabled;
  const testing = tester.state !== "idle";
  const test = tester.state === "idle" ? tester.data?.test : undefined;

  return (
    <Card className={cn("p-5", deleter.state !== "idle" && "opacity-50")}>
      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <p className="truncate font-mono text-sm font-medium text-ink" title={hook.url}>
            {hook.url}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {hook.events.map((e) => (
              <span key={e} className="rounded bg-gray-100 px-2 py-0.5 font-mono text-xs text-gray-700">
                {e}
              </span>
            ))}
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          {enabled ? "Enabled" : "Paused"}
          <Switch
            checked={enabled}
            onCheckedChange={(v) =>
              toggler.submit({ intent: "toggle", id: hook.id, enabled: String(v) }, { method: "post" })
            }
            aria-label="Enabled"
          />
        </label>
        <DropdownMenu>
          <DropdownMenuTrigger className="rounded p-1 text-gray-700 hover:bg-gray-100" aria-label="Webhook actions">
            <MoreHorizontal className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onSelect={onEdit}>Edit</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              destructive
              onSelect={() => {
                if (confirm("Delete this webhook? Its delivery history will be deleted too.")) {
                  deleter.submit({ intent: "delete", id: hook.id }, { method: "post" });
                }
              }}
            >
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="mt-4 space-y-3 border-t border-gray-100 pt-4">
        <SecretRow hook={hook} />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <DeliveryStatus d={hook.lastDelivery} />
          <Button
            variant="secondary"
            size="sm"
            disabled={testing}
            onClick={() => tester.submit({ intent: "test", id: hook.id }, { method: "post" })}
          >
            <Send /> {testing ? "Sending…" : "Send test event"}
          </Button>
        </div>
        {test && (
          <Alert tone={test.ok ? "success" : "error"}>
            {test.ok ? "Test event delivered" : "Test event failed"}
            {test.httpStatus != null && <> · HTTP {test.httpStatus}</>}
            {test.durationMs != null && <> · {test.durationMs} ms</>}
            {!test.ok && test.error && <span className="mt-1 block break-words font-mono text-xs">{test.error}</span>}
          </Alert>
        )}
        <ResultError result={toggler.data ?? deleter.data} />
      </div>
    </Card>
  );
}

const VERIFY_SNIPPET = `import crypto from "node:crypto";

// rawBody: the exact request body string, before JSON parsing.
export function verifyOpenScore(rawBody, signatureHeader, secret) {
  const parts = Object.fromEntries(
    signatureHeader.split(",").map((p) => p.split("=")),
  );
  const expected = crypto
    .createHmac("sha256", secret)
    .update(\`\${parts.t}.\${rawBody}\`)
    .digest("hex");
  const fresh = Math.abs(Date.now() / 1000 - Number(parts.t)) < 300;
  const a = Buffer.from(expected);
  const b = Buffer.from(parts.v1 ?? "");
  return fresh && a.length === b.length && crypto.timingSafeEqual(a, b);
}`;

function Docs() {
  return (
    <Card className="p-6">
      <h2 className="font-semibold text-ink">How webhooks work</h2>
      <p className="mt-1 text-sm text-gray-600">
        Each event is sent as a <code>POST</code> with a JSON body. Draft-mode test responses are sent too, with{" "}
        <code>"isTest": true</code>.
      </p>
      <SectionLabel className="mb-2 mt-5">Headers</SectionLabel>
      <dl className="divide-y divide-gray-100 rounded-md border border-gray-200 text-sm">
        {[
          ["OpenScore-Event", "lead.captured, response.completed or ping (test events)"],
          ["OpenScore-Delivery", "Unique delivery ID. Retries reuse it, so you can de-duplicate."],
          ["OpenScore-Signature", 't=<unix seconds>,v1=<hex HMAC-SHA256 of "<t>.<raw body>" with your secret>'],
        ].map(([h, d]) => (
          <div key={h} className="grid gap-1 px-3 py-2 sm:grid-cols-[180px_1fr]">
            <dt className="font-mono text-[13px] text-ink">{h}</dt>
            <dd className="text-gray-600">{d}</dd>
          </div>
        ))}
      </dl>
      <SectionLabel className="mb-2 mt-5">Retries</SectionLabel>
      <p className="text-sm text-gray-600">
        Respond with any 2xx status within 10 seconds. Otherwise we retry after 1 minute, 5 minutes, 30 minutes, 2 hours
        and 6 hours, then mark the delivery as failed.
      </p>
      <SectionLabel className="mb-2 mt-5">Verify the signature (Node.js)</SectionLabel>
      <div className="relative">
        <pre className="overflow-x-auto rounded-md bg-ink p-4 text-[12.5px] leading-relaxed text-gray-100">
          <code>{VERIFY_SNIPPET}</code>
        </pre>
        <CopyButton value={VERIFY_SNIPPET} label="Copy code" className="absolute right-2 top-2" />
      </div>
    </Card>
  );
}

export default function Integrate({ loaderData }: Route.ComponentProps) {
  const { webhooks } = loaderData;
  const [dialog, setDialog] = useState<{ open: boolean; hook: Hook | null }>({ open: false, hook: null });
  const openNew = () => setDialog({ open: true, hook: null });

  return (
    <PageContainer className="max-w-5xl">
      <h1 className="text-2xl font-semibold tracking-tight text-ink">Available Integrations</h1>
      <hr className="mb-6 mt-4 border-gray-200" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <button
          type="button"
          onClick={openNew}
          className="flex items-center gap-4 rounded-lg border border-gray-200 bg-white p-4 text-left hover:border-brand-500 hover:shadow-sm"
        >
          <span className="grid size-12 shrink-0 place-items-center rounded-lg bg-ink text-brand-200">
            <Webhook className="size-6" />
          </span>
          <span>
            <span className="block font-semibold text-ink">Webhooks</span>
            <span className="block text-sm text-gray-600">
              {webhooks.length === 0 ? "Configure" : `${webhooks.length} configured`}
            </span>
          </span>
        </button>
      </div>

      <div className="mb-4 mt-10 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-ink">Webhooks</h2>
          <p className="text-sm text-gray-600">
            Send leads and results to your CRM, Zapier, Make, n8n or your own API.
          </p>
        </div>
        <Button onClick={openNew}>
          <Plus /> Add webhook
        </Button>
      </div>

      <div className="space-y-4">
        {webhooks.length === 0 ? (
          <Card className="px-6 py-12 text-center">
            <p className="font-medium text-ink">No webhooks yet</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-gray-600">
              Add an endpoint to receive <code>lead.captured</code> and <code>response.completed</code> events in real
              time.
            </p>
            <Button className="mt-4" onClick={openNew}>
              <Plus /> Add webhook
            </Button>
          </Card>
        ) : (
          webhooks.map((h) => <HookCard key={h.id} hook={h} onEdit={() => setDialog({ open: true, hook: h })} />)
        )}
        <Docs />
      </div>

      <HookDialog
        key={dialog.hook?.id ?? "new"}
        hook={dialog.hook}
        open={dialog.open}
        onOpenChange={(open) => setDialog((d) => ({ ...d, open }))}
      />
    </PageContainer>
  );
}
