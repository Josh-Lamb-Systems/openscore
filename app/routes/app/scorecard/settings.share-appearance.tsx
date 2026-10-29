import { ImageIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { useFetcher } from "react-router";
import { useFlash } from "~/components/admin/feedback";
import { SaveBar, SettingsPage, SettingsSection } from "~/components/admin/form-bits";
import { Field, Input, Textarea } from "~/components/ui/input";
import type { ActionResult } from "~/lib/admin/action-result";
import { isHttpUrl } from "~/lib/admin/brand-tokens";
import { scorecardTitle } from "~/lib/admin/meta";
import { fail, ok, str } from "~/server/admin-actions.server";
import { appUrl } from "~/server/env.server";
import { requireScorecard, updateScorecard } from "~/server/scorecards.server";
import type { Route } from "./+types/settings.share-appearance";

export function meta({ matches }: Route.MetaArgs) {
  return scorecardTitle("Share appearance", matches);
}

export async function loader({ params }: Route.LoaderArgs) {
  const sc = await requireScorecard(params.id);
  const ss = sc.draftDefinition.startScreen;
  return {
    id: sc.id,
    values: {
      shareTitle: sc.settings.shareTitle ?? "",
      shareDescription: sc.settings.shareDescription ?? "",
      shareImageUrl: sc.settings.shareImageUrl ?? "",
    },
    fallback: { title: ss.title || sc.name, description: ss.subtitle || ss.description, imageUrl: ss.imageUrl ?? "" },
    host: new URL(appUrl()).host,
  };
}

export async function action({ request, params }: Route.ActionArgs) {
  const sc = await requireScorecard(params.id);
  const form = await request.formData();
  const intent = str(form, "intent");
  if (intent !== "save") return fail(intent, "Unknown action.");
  const shareTitle = str(form, "shareTitle").trim().slice(0, 200);
  const shareDescription = str(form, "shareDescription").trim().slice(0, 500);
  const shareImageUrl = str(form, "shareImageUrl").trim();
  if (shareImageUrl && !isHttpUrl(shareImageUrl)) {
    return fail(intent, "Check the highlighted fields.", { shareImageUrl: "Use a full http(s):// URL." });
  }
  await updateScorecard(sc.id, { settings: { ...sc.settings, shareTitle, shareDescription, shareImageUrl } });
  return ok(intent, "Share appearance saved");
}

type Values = Route.ComponentProps["loaderData"]["values"];

function Counter({ value, max }: { value: string; max: number }) {
  return (
    <span className={value.length > max ? "text-amber-700" : undefined}>
      {value.length}/{max} characters recommended
    </span>
  );
}

function ShareAppearanceForm({ loaderData }: { loaderData: Route.ComponentProps["loaderData"] }) {
  const fetcher = useFetcher<ActionResult>();
  const [values, setValues] = useState<Values>(loaderData.values);
  const saved = useFlash(fetcher.state, fetcher.data);
  useEffect(() => {
    if (saved) setValues(loaderData.values);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saved]);
  const set = (patch: Partial<Values>) => setValues((v) => ({ ...v, ...patch }));
  const dirty = JSON.stringify(values) !== JSON.stringify(loaderData.values);
  const busy = fetcher.state !== "idle";
  const result = fetcher.state === "idle" ? fetcher.data : undefined;
  const { fallback } = loaderData;

  const title = values.shareTitle.trim() || fallback.title;
  const description = values.shareDescription.trim() || fallback.description;
  const image = isHttpUrl(values.shareImageUrl)
    ? values.shareImageUrl
    : isHttpUrl(fallback.imageUrl)
      ? fallback.imageUrl
      : "";

  return (
    <SettingsPage
      title="Share Appearance"
      description="How your scorecard link looks when it's shared on social media, in messaging apps and in search results."
    >
      <SettingsSection title="Social sharing" boxed={false} className="border-t-0 pt-0">
        <div className="space-y-5">
          <Field label="Title" htmlFor="share-title" hint={<Counter value={values.shareTitle} max={60} />}>
            <Input
              id="share-title"
              value={values.shareTitle}
              onChange={(e) => set({ shareTitle: e.target.value })}
              placeholder={fallback.title}
            />
          </Field>
          <Field
            label="Description"
            htmlFor="share-description"
            hint={<Counter value={values.shareDescription} max={160} />}
          >
            <Textarea
              id="share-description"
              rows={3}
              value={values.shareDescription}
              onChange={(e) => set({ shareDescription: e.target.value })}
              placeholder={fallback.description || "A short description of your scorecard"}
            />
          </Field>
          <Field
            label="Image URL"
            htmlFor="share-image"
            hint="1200 × 630 px works best on every platform."
            error={result && !result.ok ? result.fieldErrors?.shareImageUrl : undefined}
          >
            <Input
              id="share-image"
              type="url"
              value={values.shareImageUrl}
              onChange={(e) => set({ shareImageUrl: e.target.value })}
              placeholder="https://"
            />
          </Field>
          <p className="text-sm text-gray-500">Leave a field empty to use your start screen content instead.</p>
        </div>
      </SettingsSection>

      <SettingsSection title="Preview">
        <div className="mx-auto max-w-lg overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          {image ? (
            <img src={image} alt="" className="aspect-[1200/630] w-full bg-gray-100 object-cover" />
          ) : (
            <div className="grid aspect-[1200/630] w-full place-items-center bg-gradient-to-br from-brand-50 to-gray-100 text-gray-400">
              <span className="flex flex-col items-center gap-1 text-sm">
                <ImageIcon className="size-8" /> No image
              </span>
            </div>
          )}
          <div className="border-t border-gray-200 bg-gray-50 px-4 py-3">
            <p className="text-xs uppercase tracking-wide text-gray-500">{loaderData.host}</p>
            <p className="mt-0.5 line-clamp-1 font-semibold text-ink">{title}</p>
            {description && <p className="mt-0.5 line-clamp-2 text-sm text-gray-600">{description}</p>}
          </div>
        </div>
      </SettingsSection>

      <SaveBar
        dirty={dirty}
        busy={busy}
        onSave={() => fetcher.submit({ intent: "save", ...values }, { method: "post" })}
        onDiscard={() => setValues(loaderData.values)}
        saved={saved}
        error={result && !result.ok ? result.error : undefined}
      />
    </SettingsPage>
  );
}

export default function ShareAppearance({ loaderData }: Route.ComponentProps) {
  return <ShareAppearanceForm key={loaderData.id} loaderData={loaderData} />;
}
