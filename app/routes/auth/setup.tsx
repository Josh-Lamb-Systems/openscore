import { data, Form, redirect, useNavigation } from "react-router";
import { AuthShell } from "~/components/auth/auth-shell";
import { Button } from "~/components/ui/button";
import { Field, Input } from "~/components/ui/input";
import { Alert } from "~/components/ui/misc";
import { authErrorMessage, redirectWithAuthCookies, signUpWithPassword } from "~/server/auth-actions.server";
import { hasAnyUser } from "~/server/auth.server";
import { db, schema } from "~/server/db.server";
import type { Route } from "./+types/setup";

export function meta() {
  return [{ title: "Set up OpenScore" }];
}

export async function loader() {
  if (await hasAnyUser()) throw redirect("/login");
  return null;
}

export async function action({ request }: Route.ActionArgs) {
  if (await hasAnyUser()) throw redirect("/login");
  const form = await request.formData();
  const orgName = String(form.get("orgName") ?? "").trim();
  const name = String(form.get("name") ?? "").trim();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");

  if (!orgName || !name || !email) return data({ error: "Fill in every field." }, { status: 400 });
  if (password.length < 8) return data({ error: "Use a password of at least 8 characters." }, { status: 400 });

  const res = await signUpWithPassword(request, name, email, password);
  if (!res.ok) return data({ error: await authErrorMessage(res, "Could not create the account.") }, { status: 400 });

  await db
    .insert(schema.orgSettings)
    .values({ id: "org", name: orgName })
    .onConflictDoUpdate({ target: schema.orgSettings.id, set: { name: orgName } });

  return redirectWithAuthCookies(res, "/scorecards");
}

export default function Setup({ actionData }: Route.ComponentProps) {
  const busy = useNavigation().state !== "idle";
  return (
    <AuthShell title="Welcome to OpenScore" subtitle="Create the first admin account for this instance.">
      {actionData?.error && <Alert className="mb-4">{actionData.error}</Alert>}
      <Form method="post" className="space-y-4">
        <Field label="Organisation name" htmlFor="orgName">
          <Input id="orgName" name="orgName" required autoFocus placeholder="Acme Consulting" />
        </Field>
        <Field label="Your name" htmlFor="name">
          <Input id="name" name="name" autoComplete="name" required />
        </Field>
        <Field label="Email" htmlFor="email">
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </Field>
        <Field label="Password" htmlFor="password" hint="At least 8 characters.">
          <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} />
        </Field>
        <Button type="submit" className="w-full" disabled={busy}>
          Create admin account
        </Button>
      </Form>
    </AuthShell>
  );
}
