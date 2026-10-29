import { useEffect, useRef } from "react";
import { data, useFetcher } from "react-router";
import { SavedIndicator } from "~/components/admin/feedback";
import { Checkbox, SettingsPage, SettingsSection } from "~/components/admin/form-bits";
import { Button } from "~/components/ui/button";
import { Field, Input } from "~/components/ui/input";
import { Alert } from "~/components/ui/misc";
import type { ActionResult } from "~/lib/admin/action-result";
import { fail, ok, str } from "~/server/admin-actions.server";
import { authErrorMessage } from "~/server/auth-actions.server";
import { auth, userContext } from "~/server/auth.server";
import type { Route } from "./+types/account";
import { useAppData } from "./layout";

export function meta() {
  return [{ title: "Account · OpenScore" }];
}

export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData();
  const intent = str(form, "intent");

  if (intent === "profile") {
    const name = str(form, "name").trim();
    if (!name) return fail(intent, "Check the highlighted fields.", { name: "Enter your name." });
    try {
      await auth.api.updateUser({ body: { name: name.slice(0, 100) }, headers: request.headers });
    } catch {
      return fail(intent, "Could not update your name. Try again.");
    }
    return ok(intent, "Name updated");
  }

  if (intent === "password") {
    const currentPassword = str(form, "currentPassword");
    const newPassword = str(form, "newPassword");
    const confirmPassword = str(form, "confirmPassword");
    const errors: Record<string, string> = {};
    if (!currentPassword) errors.currentPassword = "Enter your current password.";
    if (newPassword.length < 8) errors.newPassword = "Use at least 8 characters.";
    else if (newPassword !== confirmPassword) errors.confirmPassword = "The passwords don't match.";
    if (Object.keys(errors).length) return fail(intent, "Check the highlighted fields.", errors);

    const res = await auth.api.changePassword({
      body: { currentPassword, newPassword, revokeOtherSessions: str(form, "revokeOtherSessions") === "on" },
      headers: request.headers,
      asResponse: true,
    });
    if (!res.ok) {
      const message = await authErrorMessage(res, "Could not change your password.");
      return fail(intent, message, /password/i.test(message) ? { currentPassword: message } : undefined);
    }
    // Revoking other sessions issues a new session cookie for this one.
    const headers = new Headers();
    for (const cookie of res.headers.getSetCookie()) headers.append("Set-Cookie", cookie);
    return data<ActionResult>({ ok: true, intent, message: "Password changed" }, { headers });
  }

  return fail(intent, "Unknown action.");
}

export async function loader({ context }: Route.LoaderArgs) {
  const user = context.get(userContext)!;
  return { email: user.email, role: user.role };
}

function ProfileForm({ name }: { name: string }) {
  const fetcher = useFetcher<ActionResult>();
  const result = fetcher.state === "idle" && fetcher.data?.intent === "profile" ? fetcher.data : undefined;
  return (
    <fetcher.Form method="post" className="space-y-4">
      <input type="hidden" name="intent" value="profile" />
      <Field label="Name" htmlFor="acc-name" error={result?.fieldErrors?.name}>
        <Input id="acc-name" name="name" defaultValue={name} required autoComplete="name" />
      </Field>
      {result && !result.ok && !result.fieldErrors && <Alert>{result.error}</Alert>}
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={fetcher.state !== "idle"}>
          Save name
        </Button>
        <SavedIndicator fetcher={fetcher} intent="profile" />
      </div>
    </fetcher.Form>
  );
}

function PasswordForm() {
  const fetcher = useFetcher<ActionResult>();
  const formRef = useRef<HTMLFormElement>(null);
  const result = fetcher.state === "idle" && fetcher.data?.intent === "password" ? fetcher.data : undefined;
  const errors = result && !result.ok ? (result.fieldErrors ?? {}) : {};
  useEffect(() => {
    if (result?.ok) formRef.current?.reset();
  }, [result]);

  return (
    <fetcher.Form ref={formRef} method="post" className="space-y-4">
      <input type="hidden" name="intent" value="password" />
      <Field label="Current password" htmlFor="acc-current" error={errors.currentPassword}>
        <Input id="acc-current" name="currentPassword" type="password" autoComplete="current-password" required />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="New password" htmlFor="acc-new" hint="At least 8 characters." error={errors.newPassword}>
          <Input id="acc-new" name="newPassword" type="password" autoComplete="new-password" required minLength={8} />
        </Field>
        <Field label="Confirm new password" htmlFor="acc-confirm" error={errors.confirmPassword}>
          <Input id="acc-confirm" name="confirmPassword" type="password" autoComplete="new-password" required />
        </Field>
      </div>
      <label className="flex items-center gap-2 text-sm text-gray-800">
        <Checkbox name="revokeOtherSessions" defaultChecked />
        Sign out of all other devices
      </label>
      {result && !result.ok && Object.keys(errors).length === 0 && <Alert>{result.error}</Alert>}
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={fetcher.state !== "idle"}>
          Change password
        </Button>
        <SavedIndicator fetcher={fetcher} intent="password" />
      </div>
    </fetcher.Form>
  );
}

export default function Account({ loaderData }: Route.ComponentProps) {
  const { user } = useAppData();
  return (
    <SettingsPage title="Account" description="Your personal sign-in details.">
      <SettingsSection title="Profile">
        <dl className="mb-5 grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-gray-600">Email</dt>
            <dd className="mt-0.5 font-medium text-ink">{loaderData.email}</dd>
          </div>
          <div>
            <dt className="text-gray-600">Role</dt>
            <dd className="mt-0.5 font-medium capitalize text-ink">{loaderData.role}</dd>
          </div>
        </dl>
        <ProfileForm name={user.name} />
      </SettingsSection>
      <SettingsSection title="Password">
        <PasswordForm />
      </SettingsSection>
    </SettingsPage>
  );
}
