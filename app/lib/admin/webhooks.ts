/** Webhook events an endpoint can subscribe to (docs/SPEC.md §10). */
export type WebhookEventName = "lead.captured" | "response.completed";

export const WEBHOOK_EVENTS: { value: WebhookEventName; label: string; description: string }[] = [
  { value: "lead.captured", label: "Lead captured", description: "When the lead form is submitted." },
  {
    value: "response.completed",
    label: "Response completed",
    description: "When a respondent finishes and is scored.",
  },
];

export function isWebhookEvent(v: string): v is WebhookEventName {
  return WEBHOOK_EVENTS.some((e) => e.value === v);
}
