import { useMemo, useState } from "react";
import { Link, useFetcher } from "react-router";
import { BrandTokensEditor } from "~/components/admin/brand-tokens-editor";
import { useFlash } from "~/components/admin/feedback";
import { SaveBar } from "~/components/admin/form-bits";
import { ThemePreview } from "~/components/admin/theme-preview";
import { Button } from "~/components/ui/button";
import { Field, Select } from "~/components/ui/input";
import { Card } from "~/components/ui/misc";
import type { ActionResult } from "~/lib/admin/action-result";
import { parseBrandTokenOverrides } from "~/lib/admin/brand-tokens";
import { scorecardTitle } from "~/lib/admin/meta";
import { resolveTheme, type BrandTokens } from "~/lib/theme";
import { fail, ok, str } from "~/server/admin-actions.server";
import { getOrgSettings, listBrandKits } from "~/server/admin-org.server";
import { getBrandKit, requireScorecard, updateScorecard } from "~/server/scorecards.server";
import type { Route } from "./+types/theme";

export function meta({ matches }: Route.MetaArgs) {
  return scorecardTitle("Theme", matches);
}

export async function loader({ params }: Route.LoaderArgs) {
  const sc = await requireScorecard(params.id);
  const [kits, org] = await Promise.all([listBrandKits(), getOrgSettings()]);
  const question = sc.draftDefinition.questions.find((q) => q.type !== "info" && q.text.trim()) ?? null;
  return {
    scorecardId: sc.id,
    brandKitId: sc.brandKitId,
    overrides: sc.themeOverrides ?? {},
    kits: kits.map((k) => ({ id: k.id, name: k.name, tokens: k.tokens })),
    defaultKitId: org.defaultBrandKitId,
    question,
  };
}

export async function action({ request, params }: Route.ActionArgs) {
  const sc = await requireScorecard(params.id);
  const form = await request.formData();
  const intent = str(form, "intent");
  if (intent !== "save") return fail(intent, "Unknown action.");

  const brandKitId = str(form, "brandKitId") || null;
  if (brandKitId && !(await getBrandKit(brandKitId))) return fail(intent, "That brand kit no longer exists.");
  const parsed = parseBrandTokenOverrides(str(form, "overrides"));
  if (!parsed.ok) return fail(intent, "Check the highlighted fields.", parsed.errors);
  await updateScorecard(sc.id, { brandKitId, themeOverrides: parsed.overrides });
  return ok(intent, "Theme saved");
}

function ThemeEditor({ loaderData }: { loaderData: Route.ComponentProps["loaderData"] }) {
  const fetcher = useFetcher<ActionResult>();
  const [kitId, setKitId] = useState<string>(loaderData.brandKitId ?? "");
  const [overrides, setOverrides] = useState<Partial<BrandTokens>>(loaderData.overrides);

  const kit = loaderData.kits.find((k) => k.id === kitId) ?? null;
  const theme = useMemo(() => resolveTheme(kit?.tokens, overrides), [kit, overrides]);
  const dirty =
    kitId !== (loaderData.brandKitId ?? "") || JSON.stringify(overrides) !== JSON.stringify(loaderData.overrides);
  const busy = fetcher.state !== "idle";
  const result = fetcher.state === "idle" ? fetcher.data : undefined;
  const errors = result && !result.ok ? result.fieldErrors : undefined;
  const saved = useFlash(fetcher.state, fetcher.data);
  const overrideCount = Object.keys(overrides).length;

  const save = () =>
    fetcher.submit({ intent: "save", brandKitId: kitId, overrides: JSON.stringify(overrides) }, { method: "post" });
  const discard = () => {
    setKitId(loaderData.brandKitId ?? "");
    setOverrides(loaderData.overrides);
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-10 pt-8">
      <h1 className="text-2xl font-semibold tracking-tight text-ink">Theme</h1>
      <p className="mt-1 text-gray-600">
        Start from a brand kit, then customise individual settings for this scorecard. Theme changes apply immediately,
        without publishing.
      </p>

      <div className="mt-8 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_440px]">
        <div className="space-y-6">
          <Card className="p-6">
            <Field
              label="Brand kit"
              htmlFor="brand-kit"
              hint={
                <>
                  Brand kits are shared across scorecards.{" "}
                  <Link to={kitId ? `/brand-kits/${kitId}` : "/brand-kits"} className="text-brand-700 hover:underline">
                    {kitId ? "Edit this kit" : "Manage brand kits"}
                  </Link>
                </>
              }
            >
              <Select id="brand-kit" value={kitId} onChange={(e) => setKitId(e.target.value)} className="max-w-sm">
                <option value="">Default theme</option>
                {loaderData.kits.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.name}
                    {k.id === loaderData.defaultKitId ? " (organisation default)" : ""}
                  </option>
                ))}
              </Select>
            </Field>
          </Card>

          <Card className="p-6">
            <div className="mb-6 flex items-center justify-between gap-4">
              <div>
                <h2 className="font-semibold text-ink">Customise for this scorecard</h2>
                <p className="text-sm text-gray-600">
                  {overrideCount === 0
                    ? `Using ${kit ? `"${kit.name}"` : "the default theme"} as is.`
                    : `${overrideCount} setting${overrideCount === 1 ? "" : "s"} customised.`}
                </p>
              </div>
              {overrideCount > 0 && (
                <Button variant="secondary" size="sm" onClick={() => setOverrides({})}>
                  Reset all
                </Button>
              )}
            </div>
            <BrandTokensEditor
              value={theme}
              onChange={(key, value) => setOverrides((o) => ({ ...o, [key]: value }))}
              isOverridden={(key) => key in overrides}
              onReset={(key) =>
                setOverrides((o) => {
                  const next = { ...o };
                  delete next[key];
                  return next;
                })
              }
              resetLabel={kit ? "Reset to kit" : "Reset to default"}
              errors={errors}
            />
          </Card>
        </div>

        <div className="lg:sticky lg:top-6">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500">Live preview</p>
          <ThemePreview theme={theme} question={loaderData.question ?? undefined} />
        </div>
      </div>

      <SaveBar
        dirty={dirty}
        busy={busy}
        onSave={save}
        onDiscard={discard}
        error={result && !result.ok ? result.error : undefined}
        saved={saved}
      />
    </div>
  );
}

export default function Theme({ loaderData }: Route.ComponentProps) {
  return <ThemeEditor key={loaderData.scorecardId} loaderData={loaderData} />;
}
