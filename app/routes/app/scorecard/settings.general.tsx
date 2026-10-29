import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useFetcher } from "react-router";
import { useFlash } from "~/components/admin/feedback";
import { InputAddon, SaveBar, SettingsPage, SettingsSection } from "~/components/admin/form-bits";
import { Button } from "~/components/ui/button";
import { Field, Input, Textarea } from "~/components/ui/input";
import { Alert } from "~/components/ui/misc";
import type { ActionResult } from "~/lib/admin/action-result";
import { isHttpUrl } from "~/lib/admin/brand-tokens";
import { scorecardTitle } from "~/lib/admin/meta";
import { startScreenSchema, type StartScreen } from "~/lib/scorecard/schema";
import { fail, jsonField, ok, str } from "~/server/admin-actions.server";
import { appUrl } from "~/server/env.server";
import { requireScorecard, uniqueSlug, updateDraft, updateScorecard } from "~/server/scorecards.server";
import type { Route } from "./+types/settings.general";

export function meta({ matches }: Route.MetaArgs) {
  return scorecardTitle("General settings", matches);
}

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export async function loader({ params }: Route.LoaderArgs) {
  const sc = await requireScorecard(params.id);
  return {
    id: sc.id,
    name: sc.name,
    slug: sc.slug,
    isLive: !!sc.liveVersionId,
    startScreen: sc.draftDefinition.startScreen,
    urlPrefix: appUrl("/s/"),
  };
}

export async function action({ request, params }: Route.ActionArgs) {
  const sc = await requireScorecard(params.id);
  const form = await request.formData();
  const intent = str(form, "intent");
  if (intent !== "save") return fail(intent, "Unknown action.");

  const name = str(form, "name").trim();
  const slug = str(form, "slug").trim().toLowerCase();
  const raw = jsonField(form, "startScreen") as Partial<StartScreen> | undefined;
  const errors: Record<string, string> = {};

  if (!name) errors.name = "Give your scorecard a name.";
  if (!slug) errors.slug = "Enter a URL slug.";
  else if (slug.length > 60) errors.slug = "Keep the slug to 60 characters or fewer.";
  else if (!SLUG.test(slug))
    errors.slug = "Use lowercase letters, numbers and single hyphens (not at the start or end).";
  else if (slug !== sc.slug && (await uniqueSlug(slug, sc.id)) !== slug)
    errors.slug = "Another scorecard already uses this URL.";

  const parsed = startScreenSchema.safeParse({
    ...raw,
    bullets: (raw?.bullets ?? []).map((b) => String(b).trim()).filter(Boolean),
    imageUrl: raw?.imageUrl?.trim() ? raw.imageUrl.trim() : null,
  });
  if (!parsed.success) errors.form = "Invalid start screen.";
  else {
    if (!parsed.data.title.trim()) errors.title = "The start screen needs a title.";
    if (parsed.data.imageUrl && !isHttpUrl(parsed.data.imageUrl)) errors.imageUrl = "Use a full http(s):// URL.";
    if (!parsed.data.buttonLabel.trim()) errors.buttonLabel = "Enter a button label.";
  }
  if (Object.keys(errors).length || !parsed.success) {
    return fail(intent, errors.form ?? "Check the highlighted fields.", errors);
  }

  await updateScorecard(sc.id, { name, slug });
  await updateDraft(sc.id, { startScreen: parsed.data });
  return ok(intent, "Settings saved");
}

type Loader = Route.ComponentProps["loaderData"];
type FormState = { name: string; slug: string; startScreen: StartScreen };

function initial(d: Loader): FormState {
  return { name: d.name, slug: d.slug, startScreen: d.startScreen };
}

function GeneralForm({ loaderData }: { loaderData: Loader }) {
  const fetcher = useFetcher<ActionResult>();
  const [state, setState] = useState<FormState>(() => initial(loaderData));
  const saved = useFlash(fetcher.state, fetcher.data);
  // Adopt the server-normalised values (e.g. empty bullets removed) after saving.
  useEffect(() => {
    if (saved) setState(initial(loaderData));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saved]);
  const busy = fetcher.state !== "idle";
  const result = fetcher.state === "idle" ? fetcher.data : undefined;
  const errors = result && !result.ok ? (result.fieldErrors ?? {}) : {};
  const dirty = JSON.stringify(state) !== JSON.stringify(initial(loaderData));
  const ss = state.startScreen;
  const setSS = (patch: Partial<StartScreen>) =>
    setState((s) => ({ ...s, startScreen: { ...s.startScreen, ...patch } }));
  const setBullet = (i: number, v: string) => setSS({ bullets: ss.bullets.map((b, j) => (j === i ? v : b)) });
  const moveBullet = (i: number, d: -1 | 1) => {
    const next = [...ss.bullets];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    setSS({ bullets: next });
  };

  const save = () =>
    fetcher.submit(
      { intent: "save", name: state.name, slug: state.slug, startScreen: JSON.stringify(state.startScreen) },
      { method: "post" },
    );

  return (
    <SettingsPage title="General" description="Name, public link and start screen.">
      <SettingsSection title="Scorecard" boxed={false} className="border-t-0 pt-0">
        <div className="space-y-5">
          <Field label="Scorecard name" htmlFor="name" hint="Only you and your team see this name." error={errors.name}>
            <Input
              id="name"
              value={state.name}
              onChange={(e) => setState((s) => ({ ...s, name: e.target.value }))}
              aria-invalid={!!errors.name}
            />
          </Field>
          <Field label="URL slug" htmlFor="slug" error={errors.slug} hint="Lowercase letters, numbers and hyphens.">
            <InputAddon
              id="slug"
              addon={loaderData.urlPrefix}
              value={state.slug}
              onChange={(e) => setState((s) => ({ ...s, slug: e.target.value.toLowerCase().replace(/\s+/g, "-") }))}
              aria-invalid={!!errors.slug}
              spellCheck={false}
            />
          </Field>
          {loaderData.isLive && state.slug !== loaderData.slug && (
            <Alert tone="warning">
              This scorecard is live. Changing the slug breaks existing links and embeds immediately.
            </Alert>
          )}
        </div>
      </SettingsSection>

      <SettingsSection
        title="Start screen"
        description="The first screen respondents see. Changes go live the next time you publish."
      >
        <div className="space-y-5">
          <Field label="Title" htmlFor="ss-title" error={errors.title}>
            <Input
              id="ss-title"
              value={ss.title}
              onChange={(e) => setSS({ title: e.target.value })}
              aria-invalid={!!errors.title}
            />
          </Field>
          <Field label="Subtitle" htmlFor="ss-subtitle">
            <Input id="ss-subtitle" value={ss.subtitle} onChange={(e) => setSS({ subtitle: e.target.value })} />
          </Field>
          <Field label="Description" htmlFor="ss-description">
            <Textarea
              id="ss-description"
              rows={3}
              value={ss.description}
              onChange={(e) => setSS({ description: e.target.value })}
            />
          </Field>
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-800">Bullet points</p>
            {ss.bullets.length === 0 && <p className="text-sm text-gray-500">No bullet points.</p>}
            {ss.bullets.map((b, i) => (
              <div key={i} className="flex items-center gap-1">
                <Input value={b} onChange={(e) => setBullet(i, e.target.value)} aria-label={`Bullet ${i + 1}`} />
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => moveBullet(i, -1)}
                  disabled={i === 0}
                  aria-label="Move up"
                >
                  <ArrowUp />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => moveBullet(i, 1)}
                  disabled={i === ss.bullets.length - 1}
                  aria-label="Move down"
                >
                  <ArrowDown />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setSS({ bullets: ss.bullets.filter((_, j) => j !== i) })}
                  aria-label="Remove bullet"
                >
                  <X />
                </Button>
              </div>
            ))}
            <Button variant="link" size="sm" onClick={() => setSS({ bullets: [...ss.bullets, ""] })}>
              <Plus /> Add bullet point
            </Button>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Button label" htmlFor="ss-button" error={errors.buttonLabel}>
              <Input
                id="ss-button"
                value={ss.buttonLabel}
                onChange={(e) => setSS({ buttonLabel: e.target.value })}
                aria-invalid={!!errors.buttonLabel}
              />
            </Field>
            <Field
              label="Image URL"
              htmlFor="ss-image"
              hint="Optional image shown beside the text."
              error={errors.imageUrl}
            >
              <Input
                id="ss-image"
                type="url"
                placeholder="https://"
                value={ss.imageUrl ?? ""}
                onChange={(e) => setSS({ imageUrl: e.target.value })}
                aria-invalid={!!errors.imageUrl}
              />
            </Field>
          </div>
          {ss.imageUrl && isHttpUrl(ss.imageUrl) && (
            <img src={ss.imageUrl} alt="" className="max-h-40 rounded-md border border-gray-200 object-contain" />
          )}
        </div>
      </SettingsSection>

      <SaveBar
        dirty={dirty}
        busy={busy}
        onSave={save}
        onDiscard={() => setState(initial(loaderData))}
        saved={saved}
        error={result && !result.ok ? result.error : undefined}
      />
    </SettingsPage>
  );
}

export default function GeneralSettings({ loaderData }: Route.ComponentProps) {
  return <GeneralForm key={loaderData.id} loaderData={loaderData} />;
}
