import { Palette, Plus } from "lucide-react";
import { useState } from "react";
import { data, Form, Link, redirect, useNavigation } from "react-router";
import { PageContainer } from "~/components/app/nav";
import { Button } from "~/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogFooter } from "~/components/ui/dialog";
import { Field, Input } from "~/components/ui/input";
import { Card, PageHeader } from "~/components/ui/misc";
import type { ActionResult } from "~/lib/admin/action-result";
import { FONT_OPTIONS, resolveTheme } from "~/lib/theme";
import { str } from "~/server/admin-actions.server";
import { createBrandKit, getOrgSettings, listBrandKits } from "~/server/admin-org.server";
import type { Route } from "./+types/brand-kits";

export function meta() {
  return [{ title: "Brand kits · OpenScore" }];
}

export async function loader() {
  const [kits, org] = await Promise.all([listBrandKits(), getOrgSettings()]);
  return { kits, defaultKitId: org.defaultBrandKitId };
}

export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData();
  const intent = str(form, "intent");
  if (intent === "create") {
    const name = str(form, "name").trim();
    if (!name) return data<ActionResult>({ ok: false, intent, error: "Give the brand kit a name." }, { status: 400 });
    const kit = await createBrandKit(name.slice(0, 100));
    throw redirect(`/brand-kits/${kit.id}`);
  }
  return data<ActionResult>({ ok: false, intent, error: "Unknown action." }, { status: 400 });
}

function Swatches({ colors }: { colors: string[] }) {
  return (
    <div className="flex -space-x-1.5">
      {colors.map((c, i) => (
        <span
          key={i}
          className="size-6 rounded-full border-2 border-white shadow-sm ring-1 ring-black/5"
          style={{ backgroundColor: c }}
        />
      ))}
    </div>
  );
}

export default function BrandKits({ loaderData, actionData }: Route.ComponentProps) {
  const { kits, defaultKitId } = loaderData;
  const [open, setOpen] = useState(false);
  const busy = useNavigation().state === "submitting";

  return (
    <PageContainer>
      <PageHeader
        title="Brand kits"
        description="Save your logo, colours and fonts once and reuse them across scorecards."
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus /> New brand kit
          </Button>
        }
      />

      {kits.length === 0 ? (
        <Card className="flex flex-col items-center px-6 py-16 text-center">
          <span className="grid size-12 place-items-center rounded-full bg-brand-50 text-brand-700">
            <Palette className="size-6" />
          </span>
          <p className="mt-4 font-medium text-ink">No brand kits yet</p>
          <p className="mt-1 max-w-md text-sm text-gray-600">
            Scorecards use the default OpenScore theme until you create a brand kit.
          </p>
          <Button className="mt-4" onClick={() => setOpen(true)}>
            <Plus /> New brand kit
          </Button>
        </Card>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {kits.map((kit) => {
            const t = resolveTheme(kit.tokens, null);
            return (
              <Link
                key={kit.id}
                to={`/brand-kits/${kit.id}`}
                className="group overflow-hidden rounded-lg border border-gray-200 bg-white hover:shadow-md"
              >
                <div
                  className="flex h-28 items-center justify-center gap-3 border-b border-gray-200 px-4"
                  style={{
                    backgroundColor: t.backgroundColor,
                    color: t.textColor,
                    fontFamily: FONT_OPTIONS[t.font]?.family,
                    backgroundImage: t.backgroundImageUrl ? `url(${JSON.stringify(t.backgroundImageUrl)})` : undefined,
                    backgroundSize: "cover",
                  }}
                >
                  {t.logoUrl ? (
                    <img src={t.logoUrl} alt="" className="max-h-10 max-w-32 object-contain" />
                  ) : (
                    <span className="text-lg font-semibold">Aa</span>
                  )}
                  <span
                    className="px-3 py-1.5 text-sm font-medium"
                    style={{
                      borderRadius: t.buttonRadius,
                      border: `2px solid ${t.primaryColor}`,
                      backgroundColor: t.buttonStyle === "solid" ? t.primaryColor : "transparent",
                      color: t.buttonStyle === "solid" ? "#fff" : t.primaryColor,
                    }}
                  >
                    Button
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 font-medium text-ink">
                      <span className="truncate group-hover:underline">{kit.name}</span>
                      {kit.id === defaultKitId && (
                        <span className="rounded bg-brand-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-700">
                          Default
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-gray-500">
                      {kit.scorecardCount} scorecard{kit.scorecardCount === 1 ? "" : "s"} ·{" "}
                      {FONT_OPTIONS[t.font]?.label ?? t.font}
                    </p>
                  </div>
                  <Swatches colors={[t.primaryColor, t.accentColor, t.textColor, t.backgroundColor, t.surfaceColor]} />
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title="New brand kit">
          <Form method="post">
            <DialogBody>
              <Field label="Name" htmlFor="kit-name" error={actionData?.error}>
                <Input id="kit-name" name="name" placeholder="e.g. Acme main brand" required autoFocus />
              </Field>
            </DialogBody>
            <DialogFooter>
              <Button variant="secondary" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" name="intent" value="create" disabled={busy}>
                Create brand kit
              </Button>
            </DialogFooter>
          </Form>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
