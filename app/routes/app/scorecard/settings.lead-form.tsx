import { useEffect, useMemo, useState } from "react";
import { useFetcher } from "react-router";
import { useFlash } from "~/components/admin/feedback";
import { InputAddon, RadioOption, SaveBar, SettingsPage, SettingsSection } from "~/components/admin/form-bits";
import { LeadFieldsTable } from "~/components/admin/lead-fields-table";
import { Field, Input, SectionLabel, Textarea } from "~/components/ui/input";
import { Alert } from "~/components/ui/misc";
import { Switch } from "~/components/ui/switch";
import type { ActionResult } from "~/lib/admin/action-result";
import { isHttpUrl } from "~/lib/admin/brand-tokens";
import { scorecardTitle } from "~/lib/admin/meta";
import { defaultLeadFields } from "~/lib/scorecard/defaults";
import { leadFormSchema, type LeadForm } from "~/lib/scorecard/schema";
import { validateLeadForm } from "~/lib/scorecard/validate";
import { cn } from "~/lib/utils";
import { fail, jsonField, ok, str } from "~/server/admin-actions.server";
import { markSetupStepDone } from "~/server/admin-setup.server";
import { requireScorecard, updateDraft } from "~/server/scorecards.server";
import type { Route } from "./+types/settings.lead-form";

export function meta({ matches }: Route.MetaArgs) {
  return scorecardTitle("Lead form", matches);
}

export async function loader({ params }: Route.LoaderArgs) {
  const sc = await requireScorecard(params.id);
  return { id: sc.id, leadForm: sc.draftDefinition.leadForm };
}

export async function action({ request, params }: Route.ActionArgs) {
  const sc = await requireScorecard(params.id);
  const form = await request.formData();
  const intent = str(form, "intent");
  if (intent !== "save") return fail(intent, "Unknown action.");

  const parsed = leadFormSchema.safeParse(jsonField(form, "leadForm"));
  if (!parsed.success) return fail(intent, "The lead form data is invalid.");
  const lf = parsed.data;

  // Built-in fields can be hidden or made optional, but not removed or retyped.
  const builtIns = defaultLeadFields();
  for (const b of builtIns) {
    const f = lf.fields.find((x) => x.key === b.key);
    if (!f) return fail(intent, `The "${b.label}" field can be hidden but not deleted.`);
    Object.assign(f, { id: b.id, type: b.type, builtIn: true });
  }
  const keys = new Set<string>();
  for (const f of lf.fields) {
    if (!f.builtIn) {
      if (!/^custom_[a-z0-9_]+$/i.test(f.key)) return fail(intent, `"${f.label}" has an invalid key.`);
      f.builtIn = false;
    }
    if (keys.has(f.key)) return fail(intent, "Two fields share the same key.");
    keys.add(f.key);
  }

  const fieldErrors: Record<string, string> = {};
  if (lf.consent.privacyUrl && !isHttpUrl(lf.consent.privacyUrl)) fieldErrors.privacyUrl = "Enter a valid URL.";
  const issues = validateLeadForm(lf);
  if (issues.length > 0 || Object.keys(fieldErrors).length > 0) {
    return fail(intent, issues[0]?.message ?? "Check the highlighted fields.", fieldErrors);
  }
  await updateDraft(sc.id, { leadForm: lf });
  await markSetupStepDone(sc.id, "leadForm");
  return ok(intent, "Lead form saved");
}

const CONSENT_OPTIONS = [
  { value: "implied", title: "Implied Consent", description: "Your visitors will not see any opt-in checkbox." },
  {
    value: "explicit_optional",
    title: "Explicit Consent (Optional)",
    description: "Your visitors will see an opt-in checkbox but will be able to continue without opting in.",
  },
  {
    value: "explicit_required",
    title: "Explicit Consent (Required)",
    description: "Your visitors will see an opt-in checkbox and will not be able to continue without opting in.",
  },
] as const;

const stripScheme = (url: string) => url.replace(/^https?:\/\//i, "");

function LeadFormEditor({ loaderData }: { loaderData: Route.ComponentProps["loaderData"] }) {
  const fetcher = useFetcher<ActionResult>();
  const [lf, setLf] = useState<LeadForm>(loaderData.leadForm);
  const [privacyHost, setPrivacyHost] = useState(stripScheme(loaderData.leadForm.consent.privacyUrl));
  const saved = useFlash(fetcher.state, fetcher.data);
  useEffect(() => {
    if (!saved) return;
    setLf(loaderData.leadForm);
    setPrivacyHost(stripScheme(loaderData.leadForm.consent.privacyUrl));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saved]);

  const privacyUrl = privacyHost.trim() ? `https://${stripScheme(privacyHost.trim())}` : "";
  const value: LeadForm = useMemo(() => ({ ...lf, consent: { ...lf.consent, privacyUrl } }), [lf, privacyUrl]);
  const issues = useMemo(() => validateLeadForm(value), [value]);
  const dirty = JSON.stringify(value) !== JSON.stringify(loaderData.leadForm);
  const busy = fetcher.state !== "idle";
  const result = fetcher.state === "idle" ? fetcher.data : undefined;
  const set = (patch: Partial<LeadForm>) => setLf((s) => ({ ...s, ...patch }));
  const setConsent = (patch: Partial<LeadForm["consent"]>) =>
    setLf((s) => ({ ...s, consent: { ...s.consent, ...patch } }));

  const save = () => fetcher.submit({ intent: "save", leadForm: JSON.stringify(value) }, { method: "post" });

  return (
    <SettingsPage title="Lead Form" description="Choose which details to collect and when to ask for them.">
      <SettingsSection title="Lead capture" boxed={false} className="border-t-0 pt-0">
        <div className="space-y-5">
          <label className="flex cursor-pointer items-center justify-between gap-4 rounded-lg border border-gray-200 p-4">
            <span>
              <span className="block font-medium text-ink">Collect lead details</span>
              <span className="block text-sm text-gray-600">
                Turn off to let people take the scorecard anonymously.
              </span>
            </span>
            <Switch
              checked={lf.enabled}
              onCheckedChange={(enabled) => set({ enabled })}
              aria-label="Collect lead details"
            />
          </label>

          <div className={cn("space-y-5", !lf.enabled && "pointer-events-none opacity-50")} aria-disabled={!lf.enabled}>
            <div>
              <p className="mb-1 text-sm font-medium text-gray-800">When to ask</p>
              <RadioOption
                name="position"
                value="before"
                checked={lf.position === "before"}
                onChange={() => set({ position: "before" })}
                title="Before the questions"
                description="Shown on the start screen. Captures a lead even if they don't finish."
              />
              <RadioOption
                name="position"
                value="after"
                checked={lf.position === "after"}
                onChange={() => set({ position: "after" })}
                title="After the questions"
                description="Shown before the results. Usually more people start, fewer leave details."
              />
            </div>
            <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_200px]">
              <Field label="Form title" htmlFor="lf-title">
                <Input id="lf-title" value={lf.title} onChange={(e) => set({ title: e.target.value })} />
              </Field>
              <Field label="Submit button label" htmlFor="lf-submit">
                <Input id="lf-submit" value={lf.submitLabel} onChange={(e) => set({ submitLabel: e.target.value })} />
              </Field>
            </div>
          </div>
        </div>
      </SettingsSection>

      <div className={cn("space-y-8", !lf.enabled && "pointer-events-none opacity-50")}>
        <SettingsSection
          title="Form fields"
          description="Add or remove fields on this scorecard's lead form. Name and email are included by default, but you can make them optional or hide them. Drag to reorder."
        >
          <LeadFieldsTable fields={lf.fields} onChange={(fields) => set({ fields })} />
        </SettingsSection>

        <SettingsSection
          title="Data protection settings"
          description="Control the opt-in checkbox shown on this scorecard's lead form and link to your privacy policy."
        >
          <div className="space-y-6">
            <div>
              <SectionLabel className="mb-2">Opt-in consent settings</SectionLabel>
              {CONSENT_OPTIONS.map((o) => (
                <RadioOption
                  key={o.value}
                  name="consent-mode"
                  value={o.value}
                  checked={lf.consent.mode === o.value}
                  onChange={() => setConsent({ mode: o.value })}
                  title={o.title}
                  description={o.description}
                />
              ))}
            </div>
            {lf.consent.mode !== "implied" && (
              <Field label="Checkbox label" htmlFor="consent-label">
                <Input
                  id="consent-label"
                  value={lf.consent.label}
                  onChange={(e) => setConsent({ label: e.target.value })}
                  placeholder="I agree to receive communications"
                />
              </Field>
            )}
            <div>
              <SectionLabel className="mb-2">Privacy statement</SectionLabel>
              <Textarea
                rows={4}
                value={lf.consent.privacyStatement}
                onChange={(e) => setConsent({ privacyStatement: e.target.value })}
                placeholder="Enter privacy statement…"
                aria-label="Privacy statement"
              />
            </div>
            <Field
              label={
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-900">Privacy policy URL</span>
              }
              htmlFor="privacy-url"
              error={result && !result.ok ? result.fieldErrors?.privacyUrl : undefined}
            >
              <InputAddon
                id="privacy-url"
                addon="https://"
                value={privacyHost}
                onChange={(e) => setPrivacyHost(stripScheme(e.target.value))}
                placeholder="example.com/privacy"
              />
            </Field>
          </div>
        </SettingsSection>
      </div>

      {issues.length > 0 && (
        <Alert tone="warning">
          <ul className="list-disc space-y-0.5 pl-4">
            {issues.map((i, n) => (
              <li key={n}>{i.message}</li>
            ))}
          </ul>
        </Alert>
      )}

      <SaveBar
        dirty={dirty}
        busy={busy}
        onSave={save}
        onDiscard={() => {
          setLf(loaderData.leadForm);
          setPrivacyHost(stripScheme(loaderData.leadForm.consent.privacyUrl));
        }}
        saved={saved}
        disabled={issues.length > 0}
        error={result && !result.ok ? result.error : undefined}
      />
    </SettingsPage>
  );
}

export default function LeadFormSettings({ loaderData }: Route.ComponentProps) {
  return <LeadFormEditor key={loaderData.id} loaderData={loaderData} />;
}
