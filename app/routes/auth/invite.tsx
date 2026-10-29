import { and, eq, gt, isNull } from "drizzle-orm";
import { data, Form, redirect, useNavigation } from "react-router";
import { AuthShell } from "~/components/auth/auth-shell";
import { Button } from "~/components/ui/button";
import { Field, Input } from "~/components/ui/input";
import { Alert } from "~/components/ui/misc";
import { authErrorMessage, redirectWithAuthCookies, signUpWithPassword } from "~/server/auth-actions.server";
import { getSessionUser } from "~/server/auth.server";
import { db, schema } from "~/server/db.server";
import type { Route } from "./+types/invite";

async function findInvite(token: string) {
  const [invite] = await db
    .select()
    .from(schema.invitations)
    .where(
      and(
        eq(schema.invitations.token, token),
        isNull(schema.invitations.acceptedAt),
        gt(schema.invitations.expiresAt, new Date()),
      ),
    )
    .limit(1);
  return invite ?? null;
}

export function meta() {
  return [{ title: "Accept invitation · OpenScore" }];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  if (await getSessionUser(request)) throw redirect("/scorecards");
  const invite = await findInvite(params.token);
  const [org] = await db.select().from(schema.orgSettings).limit(1);
  return { email: invite?.email ?? null, orgName: org?.name ?? "OpenScore" };
}

export async function action({ request, params }: Route.ActionArgs) {
  const invite = await findInvite(params.token);
  if (!invite) return data({ error: "This invitation is no longer valid." }, { status: 400 });
  const form = await request.formData();
  const name = String(form.get("name") ?? "").trim();
  const password = String(form.get("password") ?? "");
  if (!name) return data({ error: "Enter your name." }, { status: 400 });
  if (password.length < 8) return data({ error: "Use a password of at least 8 characters." }, { status: 400 });

  // The user.create hook matches the invitation by email and applies its role.
  const res = await signUpWithPassword(request, name, invite.email, password);
  if (!res.ok) return data({ error: await authErrorMessage(res, "Could not create the account.") }, { status: 400 });
  return redirectWithAuthCookies(res, "/scorecards");
}

export default function Invite({ loaderData, actionData }: Route.ComponentProps) {
  const busy = useNavigation().state !== "idle";
  if (!loaderData.email) {
    return (
      <AuthShell title="Invitation expired">
        <p className="text-sm text-gray-600">This invitation link is invalid or has expired. Ask an admin to send a new one.</p>
      </AuthShell>
    );
  }
  return (
    <AuthShell title={`Join ${loaderData.orgName}`} subtitle={`You've been invited as ${loaderData.email}.`}>
      {actionData?.error && <Alert className="mb-4">{actionData.error}</Alert>}
      <Form method="post" className="space-y-4">
        <Field label="Your name" htmlFor="name">
          <Input id="name" name="name" autoComplete="name" required autoFocus />
        </Field>
        <Field label="Password" htmlFor="password" hint="At least 8 characters.">
          <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} />
        </Field>
        <Button type="submit" className="w-full" disabled={busy}>
          Create account
        </Button>
      </Form>
    </AuthShell>
  );
}
