import { eq } from "drizzle-orm";
import { ArrowLeft, Star, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { data, Link, redirect, useFetcher } from "react-router";
import { BrandTokensEditor } from "~/components/admin/brand-tokens-editor";
import { useFlash } from "~/components/admin/feedback";
import { SaveBar } from "~/components/admin/form-bits";
import { ThemePreview } from "~/components/admin/theme-preview";
import { Button } from "~/components/ui/button";
import { Field, Input } from "~/components/ui/input";
import { Card } from "~/components/ui/misc";
import type { ActionResult } from "~/lib/admin/action-result";
import { parseBrandTokens } from "~/lib/admin/brand-tokens";
import { resolveTheme, type BrandTokens } from "~/lib/theme";
import { fail, ok, str } from "~/server/admin-actions.server";
import { deleteBrandKit, getOrgSettings, updateBrandKit, updateOrgSettings } from "~/server/admin-org.server";
import { db, schema } from "~/server/db.server";
import { getBrandKit } from "~/server/scorecards.server";
import type { Route } from "./+types/brand-kit";

export function meta({ loaderData }: Route.MetaArgs) {
  return [{ title: `${loaderData?.kit.name ?? "Brand kit"} · Brand kits · OpenScore` }];
}

export async function loader({ params }: Route.LoaderArgs) {
  const kit = await getBrandKit(params.kitId);
  if (!kit) throw data("Brand kit not found", { status: 404 });
  const [org, scorecards] = await Promise.all([
    getOrgSettings(),
    db
      .select({ id: schema.scorecards.id, name: schema.scorecards.name })
      .from(schema.scorecards)
      .where(eq(schema.scorecards.brandKitId, kit.id))
      .orderBy(schema.scorecards.name),
  ]);
  return {
    kit: { id: kit.id, name: kit.name, tokens: resolveTheme(kit.tokens, null) },
    isDefault: org.defaultBrandKitId === kit.id,
    scorecards,
  };
}

export async function action({ request, params }: Route.ActionArgs) {
  const kit = await getBrandKit(params.kitId);
  if (!kit) throw data("Brand kit not found", { status: 404 });
  const form = await request.formData();
  const intent = str(form, "intent");

  switch (intent) {
    case "save": {
      const name = str(form, "name").trim();
      const parsed = parseBrandTokens(str(form, "tokens"));
      const errors = parsed.ok ? {} : parsed.errors;
      if (!name) errors.name = "Give the brand kit a name.";
      if (!parsed.ok || !name) return fail(intent, "Check the highlighted fields.", errors);
      await updateBrandKit(kit.id, { name: name.slice(0, 100), tokens: parsed.tokens });
      return ok(intent, "Brand kit saved");
    }
    case "setDefault":
      await updateOrgSettings({ defaultBrandKitId: kit.id });
      return ok(intent, "Set as the default for new scorecards");
    case "unsetDefault":
      await updateOrgSettings({ defaultBrandKitId: null });
      return ok(intent, "No longer the default");
    case "delete":
      await deleteBrandKit(kit.id);
      throw redirect("/brand-kits");
  }
  return fail(intent, "Unknown action.");
}

type State = { name: string; tokens: BrandTokens };

function KitEditor({ loaderData }: { loaderData: Route.ComponentProps["loaderData"] }) {
  const { kit, isDefault, scorecards } = loaderData;
  const fetcher = useFetcher<ActionResult>();
  const actions = useFetcher<ActionResult>();
  const initial: State = { name: kit.name, tokens: kit.tokens };
  const [state, setState] = useState<State>(initial);
  const saved = useFlash(fetcher.state, fetcher.data);
  useEffect(() => {
    if (saved) setState({ name: kit.name, tokens: kit.tokens });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saved]);
  const dirty = JSON.stringify(state) !== JSON.stringify(initial);
  const busy = fetcher.state !== "idle";
  const result = fetcher.state === "idle" ? fetcher.data : undefined;
  const errors = result && !result.ok ? result.fieldErrors : undefined;
  const pendingDefault = actions.formData?.get("intent");
  const defaultNow = pendingDefault === "setDefault" ? true : pendingDefault === "unsetDefault" ? false : isDefault;

  return (
    <div className="mx-auto w-full max-w-6xl px-10 pt-8">
      <Link to="/brand-kits" className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-ink">
        <ArrowLeft className="size-4" /> Brand kits
      </Link>
      <div className="mb-6 mt-3 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-3 text-2xl font-semibold tracking-tight text-ink">
            {kit.name}
            {defaultNow && (
              <span className="rounded bg-brand-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-brand-700">
                Default
              </span>
            )}
          </h1>
          <p className="mt-1 text-gray-600">
            {scorecards.length === 0
              ? "Not used by any scorecards yet."
              : `Used by ${scorecards.length} scorecard${scorecards.length === 1 ? "" : "s"}. Changes apply to them immediately.`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            disabled={actions.state !== "idle"}
            onClick={() => actions.submit({ intent: defaultNow ? "unsetDefault" : "setDefault" }, { method: "post" })}
          >
            <Star className={defaultNow ? "fill-amber-400 text-amber-500" : undefined} />
            {defaultNow ? "Default for new scorecards" : "Set as default"}
          </Button>
          <Button
            variant="ghost"
            className="text-red-600 hover:bg-red-50"
            disabled={actions.state !== "idle"}
            onClick={() => {
              const n = scorecards.length;
              const msg =
                n > 0
                  ? `Delete "${kit.name}"? ${n} scorecard${n === 1 ? "" : "s"} using it will switch to the default theme (their own customisations are kept).`
                  : `Delete "${kit.name}"?`;
              if (confirm(msg)) actions.submit({ intent: "delete" }, { method: "post" });
            }}
          >
            <Trash2 /> Delete
          </Button>
        </div>
      </div>

      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_440px]">
        <div className="space-y-6">
          <Card className="p-6">
            <Field label="Name" htmlFor="kit-name" error={errors?.name}>
              <Input
                id="kit-name"
                value={state.name}
                onChange={(e) => setState((s) => ({ ...s, name: e.target.value }))}
                aria-invalid={!!errors?.name}
              />
            </Field>
          </Card>
          <Card className="p-6">
            <BrandTokensEditor
              value={state.tokens}
              onChange={(key, value) => setState((s) => ({ ...s, tokens: { ...s.tokens, [key]: value } }))}
              errors={errors}
            />
          </Card>
          {scorecards.length > 0 && (
            <Card className="p-6">
              <h2 className="font-semibold text-ink">Scorecards using this kit</h2>
              <ul className="mt-2 divide-y divide-gray-100 text-sm">
                {scorecards.map((s) => (
                  <li key={s.id} className="flex items-center justify-between py-2">
                    <span>{s.name}</span>
                    <Link to={`/scorecards/${s.id}/theme`} className="text-brand-700 hover:underline">
                      Theme settings
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
        <div className="lg:sticky lg:top-6">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500">Live preview</p>
          <ThemePreview theme={state.tokens} />
        </div>
      </div>

      <SaveBar
        dirty={dirty}
        busy={busy}
        onSave={() =>
          fetcher.submit({ intent: "save", name: state.name, tokens: JSON.stringify(state.tokens) }, { method: "post" })
        }
        onDiscard={() => setState(initial)}
        saved={saved}
        error={result && !result.ok ? result.error : undefined}
      />
    </div>
  );
}

export default function BrandKit({ loaderData }: Route.ComponentProps) {
  return <KitEditor key={loaderData.kit.id} loaderData={loaderData} />;
}
