import { useEffect, useState } from "react";
import { Link, useFetcher } from "react-router";
import { useFlash } from "~/components/admin/feedback";
import { SaveBar, SettingsPage, SettingsSection } from "~/components/admin/form-bits";
import { Field, Input, Select } from "~/components/ui/input";
import { Alert } from "~/components/ui/misc";
import type { ActionResult } from "~/lib/admin/action-result";
import { fail, ok, str } from "~/server/admin-actions.server";
import { getOrgSettings, listBrandKits, updateOrgSettings } from "~/server/admin-org.server";
import { requireAdmin, userContext } from "~/server/auth.server";
import { getBrandKit } from "~/server/scorecards.server";
import type { Route } from "./+types/settings.organisation";

export function meta() {
  return [{ title: "Organisation settings · OpenScore" }];
}

export async function loader({ context }: Route.LoaderArgs) {
  const user = context.get(userContext)!;
  const [org, kits] = await Promise.all([getOrgSettings(), listBrandKits()]);
  return {
    isAdmin: user.role === "admin",
    values: { name: org.name, defaultBrandKitId: org.defaultBrandKitId ?? "" },
    kits: kits.map((k) => ({ id: k.id, name: k.name })),
  };
}

export async function action({ request, context }: Route.ActionArgs) {
  requireAdmin(context.get(userContext)!);
  const form = await request.formData();
  const intent = str(form, "intent");
  if (intent !== "save") return fail(intent, "Unknown action.");
  const name = str(form, "name").trim();
  if (!name) return fail(intent, "Check the highlighted fields.", { name: "Enter your organisation's name." });
  const kitId = str(form, "defaultBrandKitId") || null;
  if (kitId && !(await getBrandKit(kitId))) return fail(intent, "That brand kit no longer exists.");
  await updateOrgSettings({ name: name.slice(0, 120), defaultBrandKitId: kitId });
  return ok(intent, "Organisation saved");
}

type Values = Route.ComponentProps["loaderData"]["values"];

export default function OrganisationSettings({ loaderData }: Route.ComponentProps) {
  const { isAdmin, kits } = loaderData;
  const fetcher = useFetcher<ActionResult>();
  const [values, setValues] = useState<Values>(loaderData.values);
  const saved = useFlash(fetcher.state, fetcher.data);
  useEffect(() => {
    if (saved) setValues(loaderData.values);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saved]);
  const dirty = JSON.stringify(values) !== JSON.stringify(loaderData.values);
  const result = fetcher.state === "idle" ? fetcher.data : undefined;

  return (
    <SettingsPage title="Organisation" description="Settings shared by everyone in your OpenScore workspace.">
      {!isAdmin && <Alert tone="info">Only admins can change organisation settings.</Alert>}
      <SettingsSection title="Details" boxed={false} className="border-t-0 pt-0">
        <div className="space-y-5">
          <Field
            label="Organisation name"
            htmlFor="org-name"
            hint="Shown in the top bar and in invitation emails."
            error={result && !result.ok ? result.fieldErrors?.name : undefined}
          >
            <Input
              id="org-name"
              value={values.name}
              disabled={!isAdmin}
              onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
            />
          </Field>
          <Field
            label="Default brand kit"
            htmlFor="org-kit"
            hint={
              <>
                New scorecards start with this kit.{" "}
                <Link to="/brand-kits" className="text-brand-700 hover:underline">
                  Manage brand kits
                </Link>
              </>
            }
          >
            <Select
              id="org-kit"
              value={values.defaultBrandKitId}
              disabled={!isAdmin}
              onChange={(e) => setValues((v) => ({ ...v, defaultBrandKitId: e.target.value }))}
            >
              <option value="">Default theme</option>
              {kits.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </SettingsSection>
      {isAdmin && (
        <SaveBar
          dirty={dirty}
          busy={fetcher.state !== "idle"}
          onSave={() => fetcher.submit({ intent: "save", ...values }, { method: "post" })}
          onDiscard={() => setValues(loaderData.values)}
          saved={saved}
          error={result && !result.ok ? result.error : undefined}
        />
      )}
    </SettingsPage>
  );
}
