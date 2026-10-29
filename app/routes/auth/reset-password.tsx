import { data, Form, redirect, useNavigation, useSearchParams } from "react-router";
import { AuthShell } from "~/components/auth/auth-shell";
import { Button } from "~/components/ui/button";
import { Field, Input } from "~/components/ui/input";
import { Alert } from "~/components/ui/misc";
import { auth } from "~/server/auth.server";
import type { Route } from "./+types/reset-password";

export function meta() {
  return [{ title: "Reset password · OpenScore" }];
}

export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData();
  const token = String(form.get("token") ?? "");
  const newPassword = String(form.get("password") ?? "");
  if (newPassword.length < 8) return data({ error: "Use a password of at least 8 characters." }, { status: 400 });
  try {
    await auth.api.resetPassword({ body: { token, newPassword } });
  } catch {
    return data({ error: "This reset link is invalid or has expired." }, { status: 400 });
  }
  throw redirect("/login");
}

export default function ResetPassword({ actionData }: Route.ComponentProps) {
  const [params] = useSearchParams();
  const busy = useNavigation().state !== "idle";
  const token = params.get("token");
  if (!token || params.get("error")) {
    return (
      <AuthShell title="Link expired">
        <p className="text-sm text-gray-600">This password reset link is invalid or has expired. Request a new one from the sign-in page.</p>
      </AuthShell>
    );
  }
  return (
    <AuthShell title="Choose a new password">
      {actionData?.error && <Alert className="mb-4">{actionData.error}</Alert>}
      <Form method="post" className="space-y-4">
        <input type="hidden" name="token" value={token} />
        <Field label="New password" htmlFor="password" hint="At least 8 characters.">
          <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} autoFocus />
        </Field>
        <Button type="submit" className="w-full" disabled={busy}>
          Save password
        </Button>
      </Form>
    </AuthShell>
  );
}
